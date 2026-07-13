"""Commodity Agent: monitors commodity prices (via the commodity ETL
pipeline), analyzes volatility against config-driven risk thresholds, and
assesses which suppliers are exposed.

Skeleton only -- demonstrates the event-driven contract (consume
query.received -> produce commodity.updated).
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


class CommodityAgent(BaseAgent):
    name = "commodity"
    output_stream_key = "commodity_updated"

    async def handle(self, routed_query: dict[str, Any]) -> dict[str, Any] | None:
        thresholds = get_platform_config().get("risk_thresholds", {})
        # TODO: pull recent commodity price history (populated by the
        # commodity ETL pipeline) and flag suppliers exposed to volatility
        # above `thresholds`.
        return {
            "query": routed_query["query"],
            "commodities": [],
            "risk_thresholds": thresholds,
            "note": f"No commodity data available yet for: {routed_query['query']!r}",
        }


if __name__ == "__main__":
    run_agent(CommodityAgent())
