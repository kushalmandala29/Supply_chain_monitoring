"""Commodity Agent: correlates commodity price volatility (commodity_history,
populated by the commodity ETL pipeline) against inventory_turnover/
days_on_hand trends (kpi_facts, PostgreSQL source of truth) to flag entities
worth a closer look.

There is no table linking a commodity_code to a specific supplier/factory/
warehouse in this schema, so this agent does NOT claim a causal link between
a given commodity and a given entity -- that would require inventing a
hardcoded mapping. Instead it reports commodity volatility and inventory
trend risk as two independently-computed, config-thresholded signals, and
flags entities as "correlated_risk" only when both signals are elevated in
the same trailing window (a temporal co-occurrence, stated as such).
"""
import sys
from pathlib import Path
from typing import Any

# Makes `agents/common` importable whether this runs from Docker (where it's
# copied in as a sibling of main.py) or natively from the repo (where it's
# one level up, under agents/).
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from common.base_agent import BaseAgent, run_agent
from common.config import get_platform_config
from common.postgres_client import get_postgres_connection

_WINDOW_DAYS = 30
# A 50% swing over the window maps to a normalized risk score of 1.0 -- a
# simple, documented heuristic (not itself a config-driven threshold, since
# it's a normalization constant rather than a business threshold).
_SWING_FOR_MAX_RISK = 50.0


def _classify_risk(score: float, thresholds: dict) -> str:
    if score >= thresholds.get("high", 0.85):
        return "high"
    if score >= thresholds.get("medium", 0.60):
        return "medium"
    return "low"


def _normalize(pct_change: float) -> float:
    return min(abs(pct_change) / _SWING_FOR_MAX_RISK, 1.0)


class CommodityAgent(BaseAgent):
    name = "commodity"
    output_stream_key = "commodity_updated"

    async def handle(self, routed_query: dict[str, Any]) -> dict[str, Any] | None:
        thresholds = get_platform_config().get("risk_thresholds", {})

        commodities = await self._fetch_commodity_volatility(thresholds)
        inventory_trends = await self._fetch_inventory_trends(thresholds)

        volatile_commodities = [c for c in commodities if c["risk_level"] != "low"]
        at_risk_entities = [e for e in inventory_trends if e["risk_level"] != "low"]
        correlated_risk = (
            [
                {"commodities": volatile_commodities, "entities": at_risk_entities}
            ]
            if volatile_commodities and at_risk_entities
            else []
        )

        return {
            "query": routed_query["query"],
            "commodities": commodities,
            "inventory_trends": inventory_trends,
            "correlated_risk": correlated_risk,
            "risk_thresholds": thresholds,
            "note": (
                "correlated_risk lists commodity volatility and inventory-trend risk that "
                "co-occurred in the trailing window -- not a claimed causal link, since no "
                "commodity-to-entity mapping exists in the schema."
                if not commodities and not inventory_trends
                else None
            ),
        }

    async def _fetch_commodity_volatility(self, thresholds: dict) -> list[dict[str, Any]]:
        conn = await get_postgres_connection()
        try:
            async with conn.cursor() as cur:
                await cur.execute(
                    """
                    SELECT
                        commodity_code,
                        (array_agg(price ORDER BY recorded_at ASC))[1] AS earliest_price,
                        (array_agg(price ORDER BY recorded_at DESC))[1] AS latest_price
                    FROM commodity_history
                    WHERE recorded_at >= now() - (%s || ' days')::interval
                    GROUP BY commodity_code
                    """,
                    (str(_WINDOW_DAYS),),
                )
                rows = await cur.fetchall()
        finally:
            await conn.close()

        results = []
        for commodity_code, earliest_price, latest_price in rows:
            earliest_price = float(earliest_price)
            latest_price = float(latest_price)
            pct_change = ((latest_price - earliest_price) / earliest_price * 100.0) if earliest_price else 0.0
            score = _normalize(pct_change)
            results.append({
                "commodity_code": commodity_code,
                "earliest_price": earliest_price,
                "latest_price": latest_price,
                "pct_change": pct_change,
                "risk_score": score,
                "risk_level": _classify_risk(score, thresholds),
            })
        return results

    async def _fetch_inventory_trends(self, thresholds: dict) -> list[dict[str, Any]]:
        conn = await get_postgres_connection()
        try:
            async with conn.cursor() as cur:
                await cur.execute(
                    """
                    SELECT
                        entity_id, entity_type, kpi_name,
                        (array_agg(kpi_value ORDER BY computed_at ASC))[1] AS earliest_value,
                        (array_agg(kpi_value ORDER BY computed_at DESC))[1] AS latest_value
                    FROM kpi_facts
                    WHERE kpi_name IN ('inventory_turnover', 'days_on_hand')
                      AND entity_type IN ('factory', 'warehouse')
                      AND computed_at >= now() - (%s || ' days')::interval
                    GROUP BY entity_id, entity_type, kpi_name
                    """,
                    (str(_WINDOW_DAYS),),
                )
                rows = await cur.fetchall()
        finally:
            await conn.close()

        results = []
        for entity_id, entity_type, kpi_name, earliest_value, latest_value in rows:
            earliest_value = float(earliest_value)
            latest_value = float(latest_value)
            pct_change = ((latest_value - earliest_value) / earliest_value * 100.0) if earliest_value else 0.0
            # inventory_turnover falling is risk (negative change); days_on_hand
            # rising is risk (positive change) -- opposite directions.
            risk_pct_change = -pct_change if kpi_name == "inventory_turnover" else pct_change
            score = _normalize(risk_pct_change) if risk_pct_change > 0 else 0.0
            results.append({
                "entity_id": entity_id,
                "entity_type": entity_type,
                "kpi_name": kpi_name,
                "earliest_value": earliest_value,
                "latest_value": latest_value,
                "pct_change": pct_change,
                "risk_score": score,
                "risk_level": _classify_risk(score, thresholds),
            })
        return results


if __name__ == "__main__":
    run_agent(CommodityAgent())
