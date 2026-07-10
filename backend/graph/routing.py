"""
Conditional Routing Logic
===========================
Determines which agents to invoke based on trigger_source and state properties.
Implements the routing strategy from spec §4.
"""

from __future__ import annotations

import logging

from backend.models.state import SwarmState

logger = logging.getLogger("scri.graph.routing")


def route_from_supervisor(state: SwarmState) -> str:
    """
    Conditional routing from the Supervisor node.

    Routes based on trigger_source:
        - live_ingestion → intelligence (text NER pipeline)
        - commodity_shock → finance (direct financial analysis)
        - analyst_query → intelligence (full pipeline)
        - synthetic_simulation → spatial (what-if simulation)
    """
    trigger = state.get("trigger_source", "analyst_query")
    agents_to_invoke = state.get("agents_invoked", [])

    logger.info(f"🔀 Routing from Supervisor | trigger={trigger}")

    if trigger == "commodity_shock":
        return "finance"
    elif trigger == "synthetic_simulation":
        return "spatial"
    elif trigger in ("live_ingestion", "analyst_query"):
        # Check if the query likely contains imagery
        query = state.get("query", "").lower()
        if any(kw in query for kw in ("satellite", "imagery", "image", "port photo", "aerial")):
            return "vision"
        return "intelligence"
    else:
        return "intelligence"


def route_after_debate(state: SwarmState) -> str:
    """
    Route after the Synthesis Critic — determines if more debate is needed.
    Enforces the N_max=3 hard cap on debate iterations.
    """
    debate_count = state.get("debate_iteration_count", 0)
    confidence = state.get("confidence_score", 0.0)

    # Check if synthesis requested another debate round
    # and we haven't exceeded the cap
    if debate_count < 3 and confidence < 0.7:
        logger.info(f"🔀 Synthesis requests debate round {debate_count + 1}/3")
        return "debate"

    logger.info("🔀 Routing to END — assessment finalized")
    return "end"
