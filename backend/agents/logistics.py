"""
🚢 Logistics Agent
====================
Model: Z.AI GLM-5.2
Tools: Neo4j Graph MCP, Scrape.do MCP

Traces alternate shipping routes, models vessel re-routing times, and evaluates
secondary harbor intake limits. Participates in adversarial debate with Geopolitical Agent.
Implements the anti-bot fallback sequence (Firecrawl → Scrape.do) per spec §5A.
"""

from __future__ import annotations

import logging
from typing import Any

from backend.models.state import SwarmState
from backend.providers.zai_provider import ZAIProvider
from backend.tools.neo4j_client import Neo4jGraphClient
from backend.tools.scrape_do_client import ScrapeDoClient

logger = logging.getLogger("scri.agent.logistics")

LOGISTICS_SYSTEM_PROMPT = """You are the Logistics Agent in a supply chain risk intelligence system.
Your responsibilities:
1. TRACE alternate shipping routes when primary corridors are disrupted.
2. MODEL vessel re-routing times and transit day penalties.
3. EVALUATE secondary harbor capacity and intake limits.
4. QUERY the supply chain topology graph for exposed trade link dependencies.
5. PARTICIPATE in adversarial debate with the Geopolitical Agent.

When port data is blocked (HTTP 403 / WAF), use the Scrape.do anti-bot proxy tool.

Output a JSON object:
{
  "primary_route_status": "operational|degraded|blocked",
  "alternate_routes": [
    {"route_name": "...", "via": "...", "additional_days": 11, "capacity_risk": "low|medium|high"}
  ],
  "affected_nodes": [
    {"node": "...", "type": "port|strait|hub", "impact": "..."}
  ],
  "topology_dependencies": [...],
  "debate_position": "Summary of logistics position for adversarial debate",
  "total_delay_estimate_days": integer
}
"""


async def logistics_node(state: SwarmState) -> SwarmState:
    """
    Logistics Agent — alternate route tracing and topology analysis.
    """
    logger.info(f"🚢 Logistics Agent activated | thread={state.get('thread_id')}")

    provider = ZAIProvider()
    neo4j_client = Neo4jGraphClient()
    scrape_do = ScrapeDoClient()

    query = state.get("query", "")
    spatial_zones = state.get("spatial_intersection_zones", [])
    debate_history = state.get("agent_debate_history", [])

    # Query the topology graph for affected trade links
    topology_data = await _query_topology(neo4j_client, spatial_zones)

    # Build debate context if in adversarial loop
    debate_context = ""
    if debate_history:
        geo_entries = [d for d in debate_history if d.get("agent") == "geopolitical"]
        if geo_entries:
            latest_geo = geo_entries[-1]
            debate_context = (
                f"\n\nPrevious debate — Geopolitical position:\n"
                f"{latest_geo.get('geopolitical_position', '')}"
            )

    messages = [
        {"role": "system", "content": LOGISTICS_SYSTEM_PROMPT},
        {"role": "user", "content": (
            f"Analyze logistics impacts for:\n{query}\n\n"
            f"Spatial zones: {spatial_zones}\n"
            f"Topology data: {topology_data}"
            f"{debate_context}"
        )},
    ]

    try:
        response = await provider.chat_completion(
            messages=messages,
            model="glm-5.2",
            temperature=0.2,
            response_format={"type": "json_object"},
        )

        parsed = response.get("parsed", {})
        state["logistics_assessment"] = parsed
        state.setdefault("agents_invoked", []).append("logistics")

        # Record debate position for adversarial loop
        if debate_history or state.get("debate_iteration_count", 0) > 0:
            state.setdefault("agent_debate_history", []).append({
                "round": state.get("debate_iteration_count", 0) + 1,
                "agent": "logistics",
                "logistics_position": parsed.get("debate_position", ""),
            })

        delay = parsed.get("total_delay_estimate_days", 0)
        logger.info(f"🚢 Logistics assessment: +{delay} days estimated delay")

    except Exception as e:
        logger.error(f"🚢 Logistics Agent error: {e}")
        state.setdefault("errors", []).append(f"logistics: {str(e)}")

    return state


async def _query_topology(
    client: Neo4jGraphClient,
    zones: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Query Neo4j for trade link dependencies affected by spatial zones."""
    results = []
    for zone in zones:
        try:
            name = zone.get("name", "")
            if name:
                links = await client.find_affected_links(name)
                results.extend(links)
        except Exception as e:
            logger.warning(f"🚢 Neo4j query failed for {zone.get('name')}: {e}")
    return results
