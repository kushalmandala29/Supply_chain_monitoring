"""
LangGraph Swarm State Definition
==================================
Central state variable shared across all agents in the computational swarm.
Mirrors the schema defined in spec §4.
"""

from __future__ import annotations

import operator
from typing import Any, TypedDict, Annotated


class SwarmState(TypedDict, total=False):
    """
    Centralized LangGraph state object passed through all agent nodes.

    Fields:
        thread_id: Unique identifier for this execution thread.
        trigger_source: Origin of the task (live_ingestion | commodity_shock |
                        analyst_query | synthetic_simulation).
        query: The raw input query or event description.
        active_coordinates: [lat, lng] of the focal geographic area.
        extracted_entities: Structured entities extracted by the Intel agent
                           (ports, nodes, cargo types, claims).
        imagery_analysis: Vision agent output — vessel counts, damage indices.
        spatial_intersection_zones: GeoJSON zones computed by Spatial agent.
        geopolitical_context: Regional stability assessment from Geo agent.
        logistics_assessment: Route traces, re-routing times from Logistics agent.
        financial_impact_kpis: Working capital, margin loss from Finance agent.
        agent_debate_history: Ordered list of adversarial debate exchanges.
        debate_iteration_count: Current iteration in the Geo↔Logistics debate loop.
        risk_summary: Final synthesized risk assessment from the Critic.
        confidence_score: Synthesis confidence (0.0 — 1.0).
        target_ui_schema: JSON layout spec dispatched to the frontend canvas.
        agents_invoked: List of agent names that participated in this thread.
        errors: List of error messages encountered during execution.
        is_simulation: Whether this run targets the shadow database.
        simulation_parameters: What-If slider parameters (delays, costs, etc.).
    """

    thread_id: str
    trigger_source: str
    query: str
    active_coordinates: list[float]
    extracted_entities: list[dict[str, Any]]
    imagery_analysis: dict[str, Any]
    spatial_intersection_zones: list[dict[str, Any]]
    geopolitical_context: dict[str, Any]
    logistics_assessment: dict[str, Any]
    financial_impact_kpis: dict[str, Any]
    agent_debate_history: Annotated[list[dict[str, Any]], operator.add]
    debate_iteration_count: int
    risk_summary: str
    confidence_score: float
    target_ui_schema: dict[str, Any]
    agents_invoked: Annotated[list[str], operator.add]
    errors: Annotated[list[str], operator.add]
    is_simulation: bool
    simulation_parameters: dict[str, Any]


def create_initial_state(
    thread_id: str,
    trigger_source: str,
    query: str = "",
    coordinates: list[float] | None = None,
    is_simulation: bool = False,
    simulation_parameters: dict[str, Any] | None = None,
) -> SwarmState:
    """Create a fresh SwarmState with default values."""
    return SwarmState(
        thread_id=thread_id,
        trigger_source=trigger_source,
        query=query,
        active_coordinates=coordinates or [0.0, 0.0],
        extracted_entities=[],
        imagery_analysis={},
        spatial_intersection_zones=[],
        geopolitical_context={},
        logistics_assessment={},
        financial_impact_kpis={},
        agent_debate_history=[],
        debate_iteration_count=0,
        risk_summary="",
        confidence_score=0.0,
        target_ui_schema={},
        agents_invoked=[],
        errors=[],
        is_simulation=is_simulation,
        simulation_parameters=simulation_parameters or {},
    )
