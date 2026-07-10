"""
🗺️ Spatial Agent
=================
Model: Google Gemini 1.5 Flash
Tools: C++ Spatial Engine MCP

Resolves location strings into explicit GeoJSON coordinates, checks route overlaps
with affected regions, and performs point-in-polygon spatial queries.
"""

from __future__ import annotations

import logging
from typing import Any

from backend.models.state import SwarmState
from backend.providers.gemini_provider import GeminiProvider
from backend.tools.spatial_engine import SpatialEngineClient

logger = logging.getLogger("scri.agent.spatial")

SPATIAL_SYSTEM_PROMPT = """You are the Spatial Agent in a supply chain risk intelligence system.
Your responsibilities:
1. RESOLVE location names (ports, straits, regions) into explicit GeoJSON coordinates.
2. COMPUTE route intersections with affected geographic zones.
3. DETERMINE which shipping corridors pass through disrupted areas.
4. OUTPUT structured spatial data for downstream agents.

Use the spatial engine tool to perform precise geometric computations 
(point-in-polygon, winding number algorithms).

Output a JSON object:
{
  "resolved_locations": [
    {"name": "...", "geojson": {"type": "Point|Polygon", "coordinates": [...]}}
  ],
  "intersection_zones": [
    {"corridor_name": "...", "overlap_percent": 0.85, "affected_routes": [...]}
  ],
  "spatial_summary": "..."
}
"""


async def spatial_node(state: SwarmState) -> SwarmState:
    """
    Spatial Agent — geographic resolution and route overlap analysis.
    """
    logger.info(f"🗺️ Spatial Agent activated | thread={state.get('thread_id')}")

    provider = GeminiProvider()
    spatial_engine = SpatialEngineClient()

    entities = state.get("extracted_entities", [])
    coordinates = state.get("active_coordinates", [0.0, 0.0])
    query = state.get("query", "")

    # Extract location entities for resolution
    location_entities = [e for e in entities if e.get("entity_type") in ("port", "node", "route")]

    messages = [
        {"role": "system", "content": SPATIAL_SYSTEM_PROMPT},
        {"role": "user", "content": (
            f"Resolve spatial data for:\n"
            f"Query: {query}\n"
            f"Focal coordinates: {coordinates}\n"
            f"Entities to resolve: {location_entities}"
        )},
    ]

    try:
        response = await provider.chat_completion(
            messages=messages,
            model="gemini-1.5-flash",
            temperature=0.1,
            response_format={"type": "json_object"},
        )

        parsed = response.get("parsed", {})

        # Run spatial intersection checks via the C++ engine
        resolved_locations = parsed.get("resolved_locations", [])
        intersection_results = await _compute_intersections(spatial_engine, resolved_locations)

        state["spatial_intersection_zones"] = intersection_results
        state.setdefault("agents_invoked", []).append("spatial")

        logger.info(f"🗺️ Resolved {len(resolved_locations)} locations, "
                     f"{len(intersection_results)} intersection zones")

    except Exception as e:
        logger.error(f"🗺️ Spatial Agent error: {e}")
        state.setdefault("errors", []).append(f"spatial: {str(e)}")

    return state


async def _compute_intersections(
    engine: SpatialEngineClient,
    locations: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Run point-in-polygon intersection checks via the C++ Spatial Engine."""
    results = []
    for loc in locations:
        geojson = loc.get("geojson", {})
        if geojson.get("type") == "Polygon":
            try:
                check = await engine.check_intersection(geojson)
                results.append({
                    "name": loc.get("name", "unknown"),
                    "geojson": geojson,
                    "intersection_data": check,
                })
            except Exception as e:
                logger.warning(f"🗺️ Spatial engine error for {loc.get('name')}: {e}")
    return results
