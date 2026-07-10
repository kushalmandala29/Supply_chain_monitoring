"""
🧠 Supervisor Agent
====================
Model: Z.AI GLM-5.2
Tools: None (orchestration only)

Parses entry triggers, manages state variable modifications, determines which
specialized agents to invoke based on trigger_source, and outputs the final
JSON layout schema to the frontend Digital Twin Canvas.
"""

from __future__ import annotations

import logging
from typing import Any

from backend.models.state import SwarmState
from backend.providers.zai_provider import ZAIProvider

logger = logging.getLogger("scri.agent.supervisor")

SUPERVISOR_SYSTEM_PROMPT = """You are the Supervisor Agent of a Multi-Agent Supply Chain Risk 
Intelligence System. Your role is to:

1. ANALYZE the incoming trigger (live_ingestion, commodity_shock, analyst_query, 
   synthetic_simulation) and determine which specialized agents to invoke.
2. ROUTE the task to appropriate agents based on content type:
   - Text content → Intelligence Agent
   - Image/satellite data → Vision Agent  
   - Financial queries → Finance Agent
   - All complex queries → Full pipeline (Intel → Spatial → Geo ↔ Logistics → Finance → Synthesis)
3. COMPILE the final JSON UI layout schema specifying which frontend components to mount.
4. NEVER perform analysis yourself — delegate to specialists.

Output a JSON object with:
{
  "agents_to_invoke": ["intelligence", "spatial", "logistics", ...],
  "routing_rationale": "explanation of routing decision",
  "ui_components": ["sankey_flow", "waterfall_chart", "debate_trace", ...]
}
"""


async def supervisor_node(state: SwarmState) -> SwarmState:
    """
    Supervisor entry point — analyzes the trigger and determines agent routing.
    """
    logger.info(f"🧠 Supervisor activated | trigger={state.get('trigger_source')} | thread={state.get('thread_id')}")

    provider = ZAIProvider()
    query = state.get("query", "")
    trigger = state.get("trigger_source", "analyst_query")

    messages = [
        {"role": "system", "content": SUPERVISOR_SYSTEM_PROMPT},
        {"role": "user", "content": f"Trigger source: {trigger}\nQuery: {query}\n"
         f"Coordinates: {state.get('active_coordinates', [0.0, 0.0])}"},
    ]

    try:
        response = await provider.chat_completion(
            messages=messages,
            model="glm-5.2",
            temperature=0.1,
            response_format={"type": "json_object"},
        )

        # Parse the routing decision
        routing_decision = response.get("parsed", {})
        agents_to_invoke = routing_decision.get("agents_to_invoke", [])
        ui_components = routing_decision.get("ui_components", [])

        # Build the UI layout schema
        target_ui_schema = _build_ui_layout_schema(ui_components, trigger)

        state["agents_invoked"] = ["supervisor"] + agents_to_invoke
        state["target_ui_schema"] = target_ui_schema

        logger.info(f"🧠 Supervisor routing → {agents_to_invoke}")

    except Exception as e:
        logger.error(f"🧠 Supervisor error: {e}")
        state.setdefault("errors", []).append(f"supervisor: {str(e)}")

    return state


def _build_ui_layout_schema(
    components: list[str],
    trigger: str,
) -> dict[str, Any]:
    """Construct the JSON layout specification for the frontend canvas."""
    layout: dict[str, Any] = {
        "layout_version": "8.0",
        "trigger_context": trigger,
        "grid": {"columns": 12, "gap": "16px"},
        "components": [],
    }

    component_map = {
        "sankey_flow": {"type": "sankey_topology", "span": 8, "row": 1},
        "waterfall_chart": {"type": "financial_waterfall", "span": 6, "row": 2},
        "impact_cards": {"type": "kpi_impact_cards", "span": 6, "row": 2},
        "debate_trace": {"type": "agent_cognitive_overlay", "span": 4, "row": 1},
        "parameter_sliders": {"type": "war_room_sliders", "span": 4, "row": 3},
        "risk_map": {"type": "spatial_risk_layer", "span": 8, "row": 3},
    }

    for comp_name in components:
        if comp_name in component_map:
            layout["components"].append({
                "id": comp_name,
                **component_map[comp_name],
            })

    return layout
