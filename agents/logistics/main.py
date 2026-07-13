"""Logistics Agent: traverses the supply-chain graph in Neo4j to find
dependencies, optimize routes, estimate delays, and analyze capacity.

Skeleton only -- demonstrates the event-driven contract (consume
query.received -> produce route.recomputed) plus a lazy Neo4j driver that
real route/dependency queries will use.
"""
import sys
from pathlib import Path
from typing import Any

from neo4j import AsyncGraphDatabase

# Makes `agents/common` importable whether this runs from Docker (where it's
# copied in as a sibling of main.py) or natively from the repo (where it's
# one level up, under agents/).
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from common.base_agent import BaseAgent, run_agent
from common.config import get_agent_settings


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
        # TODO: run Cypher traversals against the supply-chain graph (suppliers
        # -> factories -> warehouses -> ports -> routes) to answer routed_query.
        return {
            "query": routed_query["query"],
            "routes": [],
            "note": f"No graph traversal implemented yet for: {routed_query['query']!r}",
        }

    async def close(self) -> None:
        await self._driver.close()
        await super().close()


if __name__ == "__main__":
    run_agent(LogisticsAgent())
