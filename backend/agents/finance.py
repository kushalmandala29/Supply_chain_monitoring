"""
💰 Finance Agent
=================
Model: Z.AI GLM-4.6
Tools: SQL Analytics MCP

Translates hours of transport delay into stranded working capital values,
inventory carrying charges, and gross margin loss calculations.
"""

from __future__ import annotations

import logging
from typing import Any

from backend.models.state import SwarmState
from backend.providers.zai_provider import ZAIProvider
from backend.tools.sql_analytics import SQLAnalyticsClient

logger = logging.getLogger("scri.agent.finance")

FINANCE_SYSTEM_PROMPT = """You are the Finance Agent in a supply chain risk intelligence system.
Your responsibilities:
1. CALCULATE working capital impact from transport delays.
2. COMPUTE inventory carrying costs for stranded goods.
3. MODEL gross margin erosion from supply chain disruptions.
4. QUERY historical commodity price data for baseline comparisons.
5. PRODUCE financial waterfall breakdowns for the UI.

Output a JSON object:
{
  "working_capital_impact_usd": float,
  "inventory_carrying_cost_usd": float,
  "gross_margin_delta_percent": float,
  "freight_premium_usd": float,
  "total_estimated_loss_usd": float,
  "waterfall_breakdown": [
    {"label": "Baseline Revenue", "value": float, "type": "baseline"},
    {"label": "Transit Delay Cost", "value": float, "type": "decrease"},
    {"label": "Freight Premium", "value": float, "type": "decrease"},
    {"label": "Carrying Charges", "value": float, "type": "decrease"},
    {"label": "Net Revenue Impact", "value": float, "type": "total"}
  ],
  "commodity_price_deltas": [
    {"commodity": "...", "baseline": float, "projected": float, "delta_pct": float}
  ]
}
"""


async def finance_node(state: SwarmState) -> SwarmState:
    """
    Finance Agent — financial impact quantification from logistics disruptions.
    """
    logger.info(f"💰 Finance Agent activated | thread={state.get('thread_id')}")

    provider = ZAIProvider()
    sql_client = SQLAnalyticsClient()

    logistics_data = state.get("logistics_assessment", {})
    geo_context = state.get("geopolitical_context", {})
    sim_params = state.get("simulation_parameters", {})

    # Fetch historical price baselines from PostgreSQL
    price_baselines = await _fetch_price_baselines(sql_client)

    messages = [
        {"role": "system", "content": FINANCE_SYSTEM_PROMPT},
        {"role": "user", "content": (
            f"Calculate financial impact for:\n"
            f"Logistics assessment: {logistics_data}\n"
            f"Geopolitical context: {geo_context}\n"
            f"Simulation parameters: {sim_params}\n"
            f"Historical price baselines: {price_baselines}"
        )},
    ]

    try:
        response = await provider.chat_completion(
            messages=messages,
            model="glm-4.6",
            temperature=0.1,
            response_format={"type": "json_object"},
        )

        parsed = response.get("parsed", {})
        state["financial_impact_kpis"] = parsed
        state.setdefault("agents_invoked", []).append("finance")

        total_loss = parsed.get("total_estimated_loss_usd", 0)
        logger.info(f"💰 Financial impact: ${total_loss:,.2f} estimated total loss")

    except Exception as e:
        logger.error(f"💰 Finance Agent error: {e}")
        state.setdefault("errors", []).append(f"finance: {str(e)}")

    return state


async def _fetch_price_baselines(client: SQLAnalyticsClient) -> list[dict[str, Any]]:
    """Fetch recent commodity price baselines from PostgreSQL."""
    try:
        return await client.query(
            "SELECT commodity_code, AVG(spot_price) as avg_price "
            "FROM commodity_price_ticks "
            "WHERE recorded_at > NOW() - INTERVAL '7 days' "
            "GROUP BY commodity_code"
        )
    except Exception as e:
        logger.warning(f"💰 Price baseline query failed: {e}")
        return []
