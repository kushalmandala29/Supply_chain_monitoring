"""Vision Agent: retrieves satellite imagery and weather overlays (Copernicus /
Sentinel, via the satellite ETL pipeline) and analyzes cloud cover / storm
movement / ocean conditions for a query's geographic entities.

Skeleton only -- demonstrates the event-driven contract (consume
query.received -> produce satellite.ready).
"""
import sys
from pathlib import Path
from typing import Any

# Makes `agents/common` importable whether this runs from Docker (where it's
# copied in as a sibling of main.py) or natively from the repo (where it's
# one level up, under agents/).
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from common.base_agent import BaseAgent, run_agent


class VisionAgent(BaseAgent):
    name = "vision"
    output_stream_key = "satellite_ready"

    async def handle(self, routed_query: dict[str, Any]) -> dict[str, Any] | None:
        # TODO: resolve geographic entities in routed_query (via the Spatial
        # Agent's geofences) and fetch matching satellite/weather imagery.
        return {
            "query": routed_query["query"],
            "imagery": [],
            "note": f"No satellite imagery resolved yet for: {routed_query['query']!r}",
        }


if __name__ == "__main__":
    run_agent(VisionAgent())
