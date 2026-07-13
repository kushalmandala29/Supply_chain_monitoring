"""Intel Agent: scrapes news, parses RSS/GDELT/ReliefWeb feeds (via the news
ETL pipeline), extracts risk signals, and summarizes them for a query.

Currently does a live NewsAPI (https://newsapi.org) search keyed on the
user's query text, as a first real implementation. Ambient GDELT/ReliefWeb
ingestion still happens separately via the News ETL pipeline
(etl/tasks/news.py); combining that ambient store with this per-query search
(entity extraction, risk scoring) is a further TODO.
"""
import sys
from pathlib import Path
from typing import Any

import httpx

# Makes `agents/common` importable whether this runs from Docker (where it's
# copied in as a sibling of main.py) or natively from the repo (where it's
# one level up, under agents/).
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from common.base_agent import BaseAgent, run_agent
from common.config import get_agent_settings


class IntelAgent(BaseAgent):
    name = "intel"
    output_stream_key = "news_ingested"

    async def handle(self, routed_query: dict[str, Any]) -> dict[str, Any] | None:
        query = routed_query["query"]
        settings = get_agent_settings()

        if not settings.news_api_key:
            return {
                "query": query,
                "articles": [],
                "summary": "NEWS_API_KEY is not set -- add it to .env to enable live news search.",
            }

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{settings.news_api_base_url}/everything",
                params={
                    "q": query,
                    "apiKey": settings.news_api_key,
                    "language": "en",
                    "sortBy": "relevancy",
                    "pageSize": 5,
                },
            )

        if response.status_code != 200:
            return {
                "query": query,
                "articles": [],
                "summary": f"NewsAPI request failed ({response.status_code}): {response.text[:200]}",
            }

        articles = [
            {
                "title": article.get("title"),
                "source": (article.get("source") or {}).get("name"),
                "url": article.get("url"),
                "publishedAt": article.get("publishedAt"),
            }
            for article in response.json().get("articles", [])
        ]

        if not articles:
            summary = f"No recent news articles found for: {query!r}"
        else:
            headlines = "; ".join(a["title"] for a in articles[:3] if a["title"])
            summary = f"Found {len(articles)} article(s) for {query!r}: {headlines}"

        return {"query": query, "articles": articles, "summary": summary}


if __name__ == "__main__":
    run_agent(IntelAgent())
