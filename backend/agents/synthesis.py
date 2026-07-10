"""
⚖️ Synthesis (Critic) Agent
=============================
Model: Z.AI GLM-5.2
Tools: SQL Analytics MCP

Reviews final reasoning outputs from all agents, manages the adversarial debate
loop between Geopolitical and Logistics agents, enforces retry caps (N_max=3),
and commits validated payloads to the production or shadow database.
"""

from __future__ import annotations

import logging
from typing import Any

from backend.models.state import SwarmState
from backend.providers.zai_provider import ZAIProvider
from backend.tools.sql_analytics import SQLAnalyticsClient

logger = logging.getLogger("scri.agent.synthesis")

SYNTHESIS_SYSTEM_PROMPT = """You are the Synthesis Critic Agent in a supply chain risk intelligence system.
Your responsibilities:
1. REVIEW all agent outputs for logical consistency and factual accuracy.
2. ARBITRATE disagreements between Geopolitical and Logistics agent positions.
3. SYNTHESIZE a unified risk assessment with confidence scores.
4. DECIDE if another adversarial debate round is needed (max 3 rounds).
5. AUTHORIZE data commit to the production database.

Output a JSON object:
{
  "synthesis_verdict": "approved|needs_debate|rejected",
  "confidence_score": 0.0-1.0,
  "risk_summary": "Comprehensive risk assessment narrative...",
  "key_findings": ["finding1", "finding2"],
  "debate_needed": boolean,
  "debate_rationale": "Why another round is needed (if applicable)",
  "recommended_severity": "low|medium|high|critical",
  "data_commit_authorized": boolean,
  "audit_trail": {
    "agents_reviewed": [...],
    "consistency_checks": [...],
    "discrepancies_found": [...]
  }
}
"""


async def synthesis_node(state: SwarmState) -> SwarmState:
    """
    Synthesis Critic — validates and synthesizes final risk assessments.
    """
    logger.info(f"⚖️ Synthesis Critic activated | thread={state.get('thread_id')}")

    provider = ZAIProvider()
    sql_client = SQLAnalyticsClient()

    # Gather all agent outputs
    agent_outputs = {
        "extracted_entities": state.get("extracted_entities", []),
        "imagery_analysis": state.get("imagery_analysis", {}),
        "spatial_zones": state.get("spatial_intersection_zones", []),
        "geopolitical_context": state.get("geopolitical_context", {}),
        "logistics_assessment": state.get("logistics_assessment", {}),
        "financial_impact": state.get("financial_impact_kpis", {}),
        "debate_history": state.get("agent_debate_history", []),
        "debate_round": state.get("debate_iteration_count", 0),
    }

    messages = [
        {"role": "system", "content": SYNTHESIS_SYSTEM_PROMPT},
        {"role": "user", "content": (
            f"Review and synthesize the following agent outputs:\n"
            f"{agent_outputs}\n\n"
            f"Current debate round: {agent_outputs['debate_round']}/3 (max)"
        )},
    ]

    try:
        response = await provider.chat_completion(
            messages=messages,
            model="glm-5.2",
            temperature=0.1,
            response_format={"type": "json_object"},
        )

        parsed = response.get("parsed", {})

        state["risk_summary"] = parsed.get("risk_summary", "")
        state["confidence_score"] = parsed.get("confidence_score", 0.0)
        state.setdefault("agents_invoked", []).append("synthesis")

        # Handle debate loop decision
        if parsed.get("debate_needed", False):
            current_round = state.get("debate_iteration_count", 0)
            if current_round < 3:
                state["debate_iteration_count"] = current_round + 1
                logger.info(f"⚖️ Debate round {current_round + 1}/3 requested")
            else:
                logger.info("⚖️ Max debate rounds (3) reached — forcing commit")

        # Commit to database if authorized
        if parsed.get("data_commit_authorized", False):
            await _commit_assessment(sql_client, state, parsed)

        verdict = parsed.get("synthesis_verdict", "unknown")
        confidence = parsed.get("confidence_score", 0.0)
        logger.info(f"⚖️ Synthesis verdict: {verdict} (confidence: {confidence:.2f})")

    except Exception as e:
        logger.error(f"⚖️ Synthesis Critic error: {e}")
        state.setdefault("errors", []).append(f"synthesis: {str(e)}")

    return state


async def _commit_assessment(
    client: SQLAnalyticsClient,
    state: SwarmState,
    parsed: dict[str, Any],
) -> None:
    """Commit validated assessment to the appropriate database."""
    is_sim = state.get("is_simulation", False)
    target = "shadow_whatif.simulated_events" if is_sim else "validated_risk_assessments"

    try:
        await client.execute(
            f"INSERT INTO {target} (thread_id, trigger_source, risk_summary, "
            f"confidence_score, created_at) VALUES ($1, $2, $3, $4, NOW())",
            [
                state.get("thread_id", ""),
                state.get("trigger_source", ""),
                parsed.get("risk_summary", ""),
                parsed.get("confidence_score", 0.0),
            ],
        )
        logger.info(f"⚖️ Assessment committed to {target}")
    except Exception as e:
        logger.error(f"⚖️ Database commit failed: {e}")
