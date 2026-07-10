"""
Adversarial Debate Loop
========================
Manages the Geopolitical ↔ Logistics adversarial debate loop.
Enforces the hard retry cap of N_max=3 iterations per spec §4/§9.
"""

from __future__ import annotations

import logging

from backend.models.state import SwarmState
from backend.config import settings

logger = logging.getLogger("scri.graph.debate")

MAX_DEBATE_ITERATIONS = settings.app.debate_max_iterations


def should_continue_debate(state: SwarmState) -> str:
    """
    Determine if the Geopolitical ↔ Logistics debate should continue.

    Returns:
        'continue_debate' — Route back to Geopolitical for another round.
        'proceed_to_finance' — Debate complete, proceed to Finance agent.
    """
    debate_count = state.get("debate_iteration_count", 0)
    debate_history = state.get("agent_debate_history", [])

    # Hard cap: Never exceed N_max iterations
    if debate_count >= MAX_DEBATE_ITERATIONS:
        logger.info(
            f"⚔️ Debate cap reached ({MAX_DEBATE_ITERATIONS} rounds) — "
            f"forcing consensus and proceeding to Finance"
        )
        return "proceed_to_finance"

    # Check if positions have converged
    if len(debate_history) >= 2:
        geo_positions = [d for d in debate_history if d.get("agent") == "geopolitical"]
        log_positions = [d for d in debate_history if d.get("agent") == "logistics"]

        if geo_positions and log_positions:
            # If both agents have submitted positions, check for significant divergence
            # In a production system, this would use semantic similarity scoring
            if _positions_converged(geo_positions[-1], log_positions[-1]):
                logger.info("⚔️ Agent positions converged — proceeding to Finance")
                return "proceed_to_finance"

    # Continue debate if we haven't converged and haven't hit the cap
    if debate_count > 0:
        logger.info(f"⚔️ Debate continuing — round {debate_count + 1}/{MAX_DEBATE_ITERATIONS}")
        return "continue_debate"

    # First pass through — proceed to finance
    return "proceed_to_finance"


def _positions_converged(
    geo_position: dict,
    log_position: dict,
) -> bool:
    """
    Check if Geopolitical and Logistics agent positions have converged.
    In production, this would use embedding similarity. For now, uses heuristic.
    """
    # Placeholder: Check if both agents agree on risk level
    geo_risk = geo_position.get("geopolitical_position", "")
    log_risk = log_position.get("logistics_position", "")

    # Simple heuristic — if both contain similar severity keywords
    severity_keywords = {"critical", "high", "moderate", "low"}
    geo_severity = severity_keywords.intersection(geo_risk.lower().split())
    log_severity = severity_keywords.intersection(log_risk.lower().split())

    if geo_severity and log_severity and geo_severity == log_severity:
        return True

    return False
