"""Intel Agent: scrapes news, parses RSS/GDELT/ReliefWeb feeds (via the news
ETL pipeline), and extracts risk signals for a query.

Pipeline: news -> graph -> KPI impact.
  1. news: live NewsAPI (https://newsapi.org) search keyed on the user's
     query text.
  2. graph: geocode the query, then find nearby Warehouse/Port/Factory nodes
     in Neo4j (bounding-box match on lat/lon -- there's no spatial index on
     this schema yet, so this is an approximation, not a true radius query).
  3. KPI impact: look up those facilities' latest KPI values (PostgreSQL
     kpi_facts, the source of truth) and compose a plain-language impact
     note, e.g. "Port congestion detected. Three connected warehouses
     currently maintain a 96% fill rate and may degrade."

Ambient GDELT/ReliefWeb ingestion still happens separately via the News ETL
pipeline (etl/tasks/news.py).
"""
import math
import sys
from pathlib import Path
from typing import Any

import httpx
from neo4j import AsyncGraphDatabase

# Makes `agents/common` importable whether this runs from Docker (where it's
# copied in as a sibling of main.py) or natively from the repo (where it's
# one level up, under agents/).
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from common.base_agent import BaseAgent, run_agent
from common.config import get_agent_settings
from common.postgres_client import get_postgres_connection

NOMINATIM_USER_AGENT = "jarvis-supply-chain-intelligence/0.1"
NEARBY_RADIUS_KM = 300.0
# The one KPI most directly tied to "may this facility degrade" for a
# generic news event -- fill_rate is the broadest operational-health signal
# available for both warehouses and routes.
IMPACT_KPI_NAME = "fill_rate"


def _bounding_box(lat: float, lon: float, radius_km: float) -> tuple[float, float, float, float]:
    delta_lat = radius_km / 111.0
    delta_lon = radius_km / (111.0 * max(math.cos(math.radians(lat)), 0.01))
    return lat - delta_lat, lat + delta_lat, lon - delta_lon, lon + delta_lon


class IntelAgent(BaseAgent):
    name = "intel"
    output_stream_key = "news_ingested"

    def __init__(self) -> None:
        super().__init__()
        settings = get_agent_settings()
        self._driver = AsyncGraphDatabase.driver(
            settings.neo4j_uri, auth=(settings.neo4j_user, settings.neo4j_password)
        )

    async def handle(self, routed_query: dict[str, Any]) -> dict[str, Any] | None:
        query = routed_query["query"]
        settings = get_agent_settings()

        articles, summary = await self._fetch_news(query, settings)
        location = await self._geocode(query)
        kpi_impact: list[dict[str, Any]] = []
        if location is not None:
            nearby = await self._find_nearby_facilities(location["lat"], location["lon"])
            kpi_impact = await self._kpi_impact_summary(nearby)

        return {
            "query": query,
            "articles": articles,
            "summary": summary,
            "location": location,
            "kpi_impact": kpi_impact,
        }

    async def _fetch_news(self, query: str, settings) -> tuple[list[dict[str, Any]], str]:
        if not settings.news_api_key:
            return [], "NEWS_API_KEY is not set -- add it to .env to enable live news search."

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
            return [], f"NewsAPI request failed ({response.status_code}): {response.text[:200]}"

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
        return articles, summary

    async def _geocode(self, query: str) -> dict[str, Any] | None:
        async with httpx.AsyncClient(timeout=10.0, headers={"User-Agent": NOMINATIM_USER_AGENT}) as client:
            try:
                response = await client.get(
                    "https://nominatim.openstreetmap.org/search",
                    params={"q": query, "format": "jsonv2", "limit": 1},
                )
                response.raise_for_status()
                results = response.json()
            except httpx.HTTPError:
                return None
        if not results:
            return None
        top = results[0]
        return {"lat": float(top["lat"]), "lon": float(top["lon"]), "label": top.get("display_name")}

    async def _find_nearby_facilities(self, lat: float, lon: float) -> list[dict[str, Any]]:
        min_lat, max_lat, min_lon, max_lon = _bounding_box(lat, lon, NEARBY_RADIUS_KM)
        async with self._driver.session() as session:
            result = await session.run(
                """
                MATCH (n)
                WHERE (n:Warehouse OR n:Port OR n:Factory)
                      AND n.lat >= $min_lat AND n.lat <= $max_lat
                      AND n.lon >= $min_lon AND n.lon <= $max_lon
                RETURN n.id AS id, n.name AS name, labels(n)[0] AS type, n.lat AS lat, n.lon AS lon
                """,
                min_lat=min_lat, max_lat=max_lat, min_lon=min_lon, max_lon=max_lon,
            )
            return await result.data()

    async def _kpi_impact_summary(self, nearby: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if not nearby:
            return []
        ids = [n["id"] for n in nearby]
        conn = await get_postgres_connection()
        try:
            async with conn.cursor() as cur:
                await cur.execute(
                    """
                    SELECT DISTINCT ON (entity_id) entity_id, kpi_value, computed_at
                    FROM kpi_facts
                    WHERE kpi_name = %s AND entity_id = ANY(%s)
                    ORDER BY entity_id, computed_at DESC
                    """,
                    (IMPACT_KPI_NAME, ids),
                )
                rows = await cur.fetchall()
        finally:
            await conn.close()

        values_by_id = {entity_id: float(value) for entity_id, value, _ in rows}
        impact = []
        for facility in nearby:
            value = values_by_id.get(facility["id"])
            if value is None:
                continue
            impact.append({
                "entity_id": facility["id"],
                "entity_type": facility["type"],
                "name": facility["name"],
                "lat": facility["lat"],
                "lon": facility["lon"],
                "kpi_name": IMPACT_KPI_NAME,
                "current_value": value,
                "note": (
                    f"{facility['name']} ({facility['type']}) currently maintains a "
                    f"{value:.0f}% {IMPACT_KPI_NAME.replace('_', ' ')} and may degrade."
                ),
            })
        return impact

    async def close(self) -> None:
        await self._driver.close()
        await super().close()


if __name__ == "__main__":
    run_agent(IntelAgent())
