"""
🌍 Geopolitical Agent
======================
Model: Google Gemini 1.5 Flash
Tools: Firecrawl MCP

Monitors regional macro-stability data, news context changes, and public security
indices. Participates in the adversarial debate loop with the Logistics Agent.
"""

from __future__ import annotations

import logging
from typing import Any

from backend.models.state import SwarmState
from backend.providers.gemini_provider import GeminiProvider
from backend.tools.firecrawl_client import FirecrawlClient

logger = logging.getLogger("scri.agent.geopolitical")

GEOPOLITICAL_SYSTEM_PROMPT = """You are the Geopolitical Agent in a supply chain risk intelligence system.
Your responsibilities:
1. ASSESS regional political stability for areas affected by supply chain disruptions.
2. MONITOR sanctions, trade restrictions, and military activity near shipping corridors.
3. EVALUATE sovereign risk factors that could escalate or mitigate supply chain impacts.
4. PARTICIPATE in adversarial debate with the Logistics Agent to stress-test conclusions.

Output a JSON object:
{
  "stability_assessment": {
    "region": "...",
    "risk_level": "low|moderate|elevated|high|critical",
    "stability_score": 0.0-1.0,
    "key_factors": ["factor1", "factor2"]
  },
  "active_threats": [
    {"threat_type": "sanctions|conflict|policy_change|natural_disaster", 
     "description": "...", "severity": 0.0-1.0}
  ],
  "recommended_actions": ["action1", "action2"],
  "debate_position": "Summary of position for adversarial debate"
}
"""


async def geopolitical_node(state: SwarmState) -> SwarmState:
    """
    Geopolitical Agent — regional stability and threat assessment.
    """
    logger.info(f"🌍 Geopolitical Agent activated | thread={state.get('thread_id')}")

    provider = GeminiProvider()
    firecrawl = FirecrawlClient()

    query = state.get("query", "")
    spatial_zones = state.get("spatial_intersection_zones", [])
    debate_history = state.get("agent_debate_history", [])

    # Build context from spatial data
    zone_context = _format_spatial_context(spatial_zones)

    # Include debate history if in adversarial loop
    debate_context = ""
    if debate_history:
        latest = debate_history[-1]
        debate_context = f"\n\nPrevious debate round — Logistics position:\n{latest.get('logistics_position', '')}"

    messages = [
        {"role": "system", "content": GEOPOLITICAL_SYSTEM_PROMPT},
        {"role": "user", "content": (
            f"Assess geopolitical context for:\n{query}\n\n"
            f"Affected spatial zones:\n{zone_context}"
            f"{debate_context}"
        )},
    ]

    try:
        response = await provider.chat_completion(
            messages=messages,
            model="gemini-1.5-flash",
            temperature=0.2,
            response_format={"type": "json_object"},
        )

        # Return only the updated keys for LangGraph state merging
        return {
            "geopolitical_context": parsed,
            "agents_invoked": ["geopolitical"],
            "agent_debate_history": [{
                "round": state.get("debate_iteration_count", 0) + 1,
                "agent": "geopolitical",
                "geopolitical_position": parsed.get("debate_position", ""),
            }] if debate_history or state.get("debate_iteration_count", 0) > 0 else []
        }

    except Exception as e:
        logger.error(f"🌍 Geopolitical Agent error: {e}")
        return {"errors": [f"geopolitical: {str(e)}"]}


def _format_spatial_context(zones: list[dict[str, Any]]) -> str:
    """Format spatial intersection zones into readable context."""
    if not zones:
        return "No specific spatial zones identified."
    parts = []
    for z in zones:
        parts.append(f"- {z.get('name', 'Unknown')}: {z.get('intersection_data', {})}")
    return "\n".join(parts)
