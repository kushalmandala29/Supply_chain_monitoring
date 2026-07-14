"""News ETL (config/settings.yaml: etl.news, default every 5 minutes).

Does a live NewsAPI (https://newsapi.org) search using the config-driven
query term (config/settings.yaml: etl.news.query), geocodes each article
(OpenStreetMap Nominatim, free/no key) so the frontend can plot a live global
feed, and publishes an ambient update on news.ingested (no session_id --
this is a background update, not a response to a specific query) so the
Intel Agent and the frontend's ambient map layer can react.

GDELT/ReliefWeb/RSS ingestion (the other configured `sources`) and upserting
extracted entities into Neo4j/PostGIS are still TODO.
"""
import json
import logging
import re
import time
from collections.abc import Iterable

import redis
import requests

from celery_app import app
from config import get_platform_config, get_settings

logger = logging.getLogger(__name__)

# Nominatim's usage policy caps free-tier requests at ~1/sec -- geocoding
# every article in a batch would make each 5-minute cycle take too long, so
# only the most recent few get a map pin.
GEOCODE_ARTICLE_LIMIT = 3
GEOCODE_CANDIDATES_PER_ARTICLE = 3
NOMINATIM_USER_AGENT = "jarvis-supply-chain-intelligence/0.1"

# Nominatim is a structured place geocoder, not a natural-language search
# engine: it matches a bare "Shanghai" fine but returns nothing for
# "Shanghai port congestion eases" (and "Shanghai port" alone can match an
# unrelated business with that name). So headlines are reduced to candidate
# proper-noun tokens first, and each candidate is tried until one resolves
# to a real place -- rather than geocoding the raw headline text.
_STOPWORDS = {
    "The", "A", "An", "In", "On", "At", "To", "For", "Of", "And", "Or", "But",
    "Is", "Are", "Was", "Were", "How", "Why", "What", "When", "Who", "Which",
    "This", "That", "These", "Those", "New", "Top", "Best", "Update", "News",
    "As", "By", "It", "Its", "With", "From", "After", "Before", "Amid",
}


def _candidate_places(text: str) -> list[str]:
    words = re.findall(r"\b[A-Z][a-zA-Z]+\b", text)
    seen: set[str] = set()
    candidates = []
    for word in words:
        if word in _STOPWORDS or word in seen:
            continue
        seen.add(word)
        candidates.append(word)
    return candidates[:GEOCODE_CANDIDATES_PER_ARTICLE]


def _geocode(query: str) -> dict | None:
    try:
        response = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": query, "format": "jsonv2", "limit": 1},
            headers={"User-Agent": NOMINATIM_USER_AGENT},
            timeout=10,
        )
        response.raise_for_status()
        results = response.json()
    except requests.RequestException:
        return None
    if not results:
        return None
    top = results[0]
    return {"lat": float(top["lat"]), "lon": float(top["lon"]), "label": top.get("display_name")}


def _geocode_headline(title: str) -> dict | None:
    for candidate in _candidate_places(title):
        location = _geocode(candidate)
        time.sleep(1)  # respect Nominatim's ~1 request/second usage policy
        if location:
            return location
    return None


def _risk_tags(text: str) -> list[str]:
    lowered = text.lower()
    tags = []
    keyword_groups = {
        "port": ["port", "terminal", "harbor", "harbour", "canal"],
        "shipping": ["shipping", "freight", "container", "vessel", "cargo"],
        "weather": ["storm", "flood", "hurricane", "typhoon", "cyclone"],
        "labor": ["strike", "walkout", "labor", "union"],
        "geopolitical": ["war", "sanction", "border", "attack", "conflict"],
        "commodity": ["oil", "gas", "wheat", "corn", "copper", "semiconductor"],
    }
    for tag, keywords in keyword_groups.items():
        if any(keyword in lowered for keyword in keywords):
            tags.append(tag)
    return tags


def _normalize_article(
    *,
    title: str | None,
    source: str | None,
    url: str | None,
    published_at: str | None,
    location_hint: str | None = None,
    image_url: str | None = None,
) -> dict | None:
    if not title or not url:
        return None
    tags = _risk_tags(title)
    return {
        "title": title,
        "source": source,
        "url": url,
        "publishedAt": published_at,
        "location_hint": location_hint,
        "image_url": image_url,
        "risk_tags": tags,
        "risk_level": "medium" if tags else "low",
    }


def _dedupe_articles(articles: Iterable[dict]) -> list[dict]:
    seen: set[str] = set()
    unique = []
    for article in articles:
        key = article.get("url") or article.get("title")
        if not key or key in seen:
            continue
        seen.add(key)
        unique.append(article)
    return unique


def _fetch_newsapi_articles(settings, query: str) -> list[dict]:
    if not settings.news_api_key:
        logger.info("NEWS_API_KEY not set -- skipping NewsAPI fetch")
        return []
    try:
        response = requests.get(
            f"{settings.news_api_base_url}/everything",
            params={
                "q": query,
                "apiKey": settings.news_api_key,
                "language": "en",
                "sortBy": "publishedAt",
            },
            timeout=10,
        )
        response.raise_for_status()
    except requests.RequestException:
        logger.exception("NewsAPI fetch failed for query %r", query)
        return []
    articles = []
    for article in response.json().get("articles", []):
        normalized = _normalize_article(
            title=article.get("title"),
            source=(article.get("source") or {}).get("name"),
            url=article.get("url"),
            published_at=article.get("publishedAt"),
            image_url=article.get("urlToImage"),
        )
        if normalized:
            articles.append(normalized)
    return articles


def _fetch_gdelt_articles(settings, query: str) -> list[dict]:
    for attempt in range(3):
        try:
            response = requests.get(
                f"{settings.gdelt_base_url.rstrip('/')}/doc/doc",
                params={
                    "query": query,
                    "mode": "ArtList",
                    "format": "json",
                    "sort": "DateDesc",
                },
                timeout=20,
            )
            response.raise_for_status()
            break
        except requests.RequestException as e:
            if attempt == 2:
                logger.warning("GDELT fetch failed after 3 attempts for query %r: %s", query, e)
                return []
            time.sleep(2 ** attempt)
    articles = []
    for article in response.json().get("articles", []):
        normalized = _normalize_article(
            title=article.get("title"),
            source=article.get("domain"),
            url=article.get("url"),
            published_at=article.get("seendate"),
            location_hint=article.get("sourcecountry"),
            image_url=article.get("socialimage"),
        )
        if normalized:
            articles.append(normalized)
    return articles


def _attach_locations(articles: list[dict]) -> None:
    for article in articles[:GEOCODE_ARTICLE_LIMIT]:
        location = None
        if article.get("location_hint"):
            location = _geocode(article["location_hint"])
            time.sleep(1)
        if not location:
            location = _geocode_headline(article["title"])
        if location:
            article["location"] = location


@app.task(name="tasks.news.run")
def run() -> None:
    settings = get_settings()
    platform_config = get_platform_config()
    streams = platform_config.get("redis_streams", {})
    news_cfg = platform_config.get("etl", {}).get("news", {})
    sources = news_cfg.get("sources", [])
    query = news_cfg.get("query", "supply chain")

    articles = _dedupe_articles(
        [
            *_fetch_gdelt_articles(settings, query),
            *_fetch_newsapi_articles(settings, query),
        ]
    )
    _attach_locations(articles)

    # TODO: also fetch from ReliefWeb/RSS/local media, extract entities, and
    # upsert relevant supply-chain entities into Neo4j/PostGIS.
    payload = {
        "sources": sources,
        "query": query,
        "articles": articles,
        "mapped_count": sum(1 for article in articles if article.get("location")),
    }

    client = redis.from_url(settings.redis_url, decode_responses=True)
    client.xadd(streams.get("news_ingested", "news.ingested"), {"data": json.dumps(payload)})
