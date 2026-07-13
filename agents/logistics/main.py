"""Logistics Agent: the KPI-aware operational agent. Answers questions like
"what is the fill rate in Southeast Asia?", "which suppliers have the worst
cycle time?", "which warehouses have poor inventory accuracy?" by querying
kpi_facts (PostgreSQL, source of truth) for the ranked values, then joining
the existing Neo4j graph for names/coordinates so the Supervisor/frontend can
place the answer on the map.
"""
import re
import sys
from pathlib import Path
from typing import Any

from neo4j import AsyncGraphDatabase

# Makes `agents/common` importable whether this runs from Docker (where it's
# copied in as a sibling of main.py) or natively from the repo (where it's
# one level up, under agents/).
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from common.base_agent import BaseAgent, run_agent
from common.config import get_agent_settings, get_platform_config
from common.postgres_client import get_postgres_connection

# Keyword -> kpi_name, checked in order so more specific phrases (e.g. "rate
# of return") are matched before a shorter substring could mismatch.
_KPI_KEYWORDS: list[tuple[str, str]] = [
    ("perfect order", "perfect_order_rate"),
    ("fill rate", "fill_rate"),
    ("inventory accuracy", "inventory_accuracy"),
    ("inventory turnover", "inventory_turnover"),
    ("turnover", "inventory_turnover"),
    ("days on hand", "days_on_hand"),
    ("rate of return", "return_rate"),
    ("return rate", "return_rate"),
    ("backorder", "backorder_rate"),
    ("on-time shipping", "on_time_shipping"),
    ("on time shipping", "on_time_shipping"),
    ("picking accuracy", "picking_accuracy"),
    ("cycle time", "order_cycle_time"),
]
_ENTITY_KEYWORDS: list[tuple[str, str]] = [
    ("warehouse", "warehouse"),
    ("supplier", "supplier"),
    ("factory", "factory"),
    ("route", "route"),
]
_WORST_WORDS = ("worst", "poor", "low", "lowest", "below", "bad", "worse")
_BEST_WORDS = ("best", "top", "highest", "good")
_DEFAULT_KPI = "fill_rate"
_DEFAULT_LIMIT = 5


def _parse_kpi_name(text: str) -> str:
    for phrase, kpi_name in _KPI_KEYWORDS:
        if phrase in text:
            return kpi_name
    return _DEFAULT_KPI


def _parse_entity_type(text: str) -> str | None:
    for phrase, entity_type in _ENTITY_KEYWORDS:
        if phrase in text:
            return entity_type
    return None


def _parse_limit(text: str) -> int:
    match = re.search(r"\btop\s+(\d+)\b", text)
    if match:
        return int(match.group(1))
    return _DEFAULT_LIMIT


def _parse_sort_order(text: str, direction: str) -> str:
    """Returns 'ASC' or 'DESC' for the SQL ORDER BY on kpi_value, given the
    KPI's configured direction (higher_is_better | lower_is_better)."""
    wants_worst = any(word in text for word in _WORST_WORDS)
    wants_best = any(word in text for word in _BEST_WORDS)
    if wants_best and not wants_worst:
        return "DESC" if direction == "higher_is_better" else "ASC"
    # Default to surfacing the worst performers first -- the more actionable
    # framing for an operational-risk question.
    return "ASC" if direction == "higher_is_better" else "DESC"


class LogisticsAgent(BaseAgent):
    name = "logistics"
    output_stream_key = "route_recomputed"

    def __init__(self) -> None:
        super().__init__()
        settings = get_agent_settings()
        self._driver = AsyncGraphDatabase.driver(
            settings.neo4j_uri, auth=(settings.neo4j_user, settings.neo4j_password)
        )

    async def handle(self, routed_query: dict[str, Any]) -> dict[str, Any] | None:
        text = routed_query["query"].lower()
        kpi_name = _parse_kpi_name(text)
        entity_type = _parse_entity_type(text)
        limit = _parse_limit(text)
        kpi_cfg = get_platform_config().get("kpi", {}).get(kpi_name, {})
        direction = kpi_cfg.get("direction", "higher_is_better")
        order = _parse_sort_order(text, direction)
        if entity_type is None:
            configured_entities = kpi_cfg.get("entities", [])
            entity_type = configured_entities[0] if configured_entities else None

        ranked = await self._fetch_ranked_kpi(kpi_name, entity_type, order, limit)
        results = await self._attach_graph_context(ranked)

        return {
            "query": routed_query["query"],
            "kpi_name": kpi_name,
            "entity_type": entity_type,
            "results": results,
            "note": None if results else f"No kpi_facts rows found yet for {kpi_name!r}.",
        }

    async def _fetch_ranked_kpi(
        self, kpi_name: str, entity_type: str | None, order: str, limit: int
    ) -> list[dict[str, Any]]:
        conn = await get_postgres_connection()
        try:
            async with conn.cursor() as cur:
                if entity_type is not None:
                    await cur.execute(
                        f"""
                        SELECT entity_id, entity_type, kpi_value, computed_at FROM (
                            SELECT DISTINCT ON (entity_id) entity_id, entity_type, kpi_value, computed_at
                            FROM kpi_facts
                            WHERE kpi_name = %s AND entity_type = %s
                            ORDER BY entity_id, computed_at DESC
                        ) latest
                        ORDER BY kpi_value {order}
                        LIMIT %s
                        """,
                        (kpi_name, entity_type, limit),
                    )
                else:
                    await cur.execute(
                        f"""
                        SELECT entity_id, entity_type, kpi_value, computed_at FROM (
                            SELECT DISTINCT ON (entity_id) entity_id, entity_type, kpi_value, computed_at
                            FROM kpi_facts
                            WHERE kpi_name = %s
                            ORDER BY entity_id, computed_at DESC
                        ) latest
                        ORDER BY kpi_value {order}
                        LIMIT %s
                        """,
                        (kpi_name, limit),
                    )
                rows = await cur.fetchall()
        finally:
            await conn.close()
        return [
            {"entity_id": r[0], "entity_type": r[1], "kpi_value": float(r[2]), "computed_at": r[3].isoformat()}
            for r in rows
        ]

    async def _attach_graph_context(self, ranked: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if not ranked:
            return []

        node_ids = [r["entity_id"] for r in ranked if r["entity_type"] != "route"]
        route_ids = [r["entity_id"] for r in ranked if r["entity_type"] == "route"]

        async with self._driver.session() as session:
            node_context: dict[str, dict] = {}
            if node_ids:
                result = await session.run(
                    "MATCH (n) WHERE n.id IN $ids "
                    "RETURN n.id AS id, n.name AS name, n.lat AS lat, n.lon AS lon, n.country AS country",
                    ids=node_ids,
                )
                for record in await result.data():
                    node_context[record["id"]] = record

            route_context: dict[str, dict] = {}
            if route_ids:
                result = await session.run(
                    """
                    MATCH (a:Port)-[r:CONNECTS_TO]->(b:Port)
                    WHERE r.route_id IN $ids
                    RETURN r.route_id AS route_id, a.name AS origin, b.name AS destination,
                           a.lat AS lat, a.lon AS lon
                    """,
                    ids=route_ids,
                )
                for record in await result.data():
                    route_context[record["route_id"]] = record

        enriched = []
        for rank, row in enumerate(ranked, start=1):
            context = (
                route_context.get(row["entity_id"], {})
                if row["entity_type"] == "route"
                else node_context.get(row["entity_id"], {})
            )
            enriched.append({**row, "rank": rank, **context})
        return enriched

    async def close(self) -> None:
        await self._driver.close()
        await super().close()


if __name__ == "__main__":
    run_agent(LogisticsAgent())
