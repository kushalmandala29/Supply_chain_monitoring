"""
LangGraph State Graph Builder
===============================
Constructs the computational swarm graph with all agent nodes,
conditional routing edges, and the adversarial debate loop.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

from langgraph.graph import StateGraph, END

from backend.models.state import SwarmState, create_initial_state
from backend.agents.supervisor import supervisor_node
from backend.agents.intelligence import intelligence_node
from backend.agents.vision import vision_node
from backend.agents.spatial import spatial_node
from backend.agents.geopolitical import geopolitical_node
from backend.agents.logistics import logistics_node
from backend.agents.finance import finance_node
from backend.agents.synthesis import synthesis_node
from backend.graph.routing import route_from_supervisor, route_after_debate
from backend.graph.debate import should_continue_debate

logger = logging.getLogger("scri.graph")


def build_swarm_graph() -> StateGraph:
    """
    Construct the LangGraph computational swarm.

    Graph topology:
        Supervisor → [Intel, Vision, Finance] (conditional routing)
        Intel & Vision → Spatial
        Spatial → Geo & Logistics
        Geo ↔ Logistics (adversarial loop, max 3 iterations)
        Geo & Logistics & Finance → Synthesis (Critic)
        Synthesis → END (or back to Geo for debate)
    """
    graph = StateGraph(SwarmState)

    # ── Register Agent Nodes ──────────────────────────────────────────────
    graph.add_node("supervisor", supervisor_node)
    graph.add_node("intelligence", intelligence_node)
    graph.add_node("vision", vision_node)
    graph.add_node("spatial", spatial_node)
    graph.add_node("geopolitical", geopolitical_node)
    graph.add_node("logistics", logistics_node)
    graph.add_node("finance", finance_node)
    graph.add_node("synthesis", synthesis_node)

    # ── Entry Point ────────────────────────────────────────────────────────
    graph.set_entry_point("supervisor")

    # ── Conditional Routing from Supervisor ────────────────────────────────
    graph.add_conditional_edges(
        "supervisor",
        route_from_supervisor,
        {
            "intelligence": "intelligence",
            "vision": "vision",
            "finance": "finance",
            "spatial": "spatial",
            "end": END,
        },
    )

    # ── Sequential Flow: Intel/Vision → Spatial ────────────────────────────
    graph.add_edge("intelligence", "spatial")
    graph.add_edge("vision", "spatial")

    # ── Spatial → Geopolitical & Logistics ─────────────────────────────────
    graph.add_edge("spatial", "geopolitical")
    graph.add_edge("spatial", "logistics")

    # ── Adversarial Debate Loop ────────────────────────────────────────────
    graph.add_edge("geopolitical", "logistics")

    # ── After Logistics: Check if debate continues or proceeds to Synthesis
    graph.add_conditional_edges(
        "logistics",
        should_continue_debate,
        {
            "continue_debate": "geopolitical",
            "proceed_to_finance": "finance",
        },
    )

    # ── Finance → Synthesis ────────────────────────────────────────────────
    graph.add_edge("finance", "synthesis")

    # ── Synthesis: Check if another debate round or commit ─────────────────
    graph.add_conditional_edges(
        "synthesis",
        route_after_debate,
        {
            "debate": "geopolitical",
            "end": END,
        },
    )

    logger.info("✅ LangGraph computational swarm constructed")
    return graph.compile()


async def invoke_swarm(
    graph: Any,
    query: str,
    trigger_source: str,
    coordinates: list[float] | None = None,
    parameters: dict[str, Any] | None = None,
) -> SwarmState:
    """
    Execute the compiled swarm graph with an initial state.
    """
    thread_id = str(uuid.uuid4())
    is_simulation = trigger_source == "synthetic_simulation"

    initial_state = create_initial_state(
        thread_id=thread_id,
        trigger_source=trigger_source,
        query=query,
        coordinates=coordinates,
        is_simulation=is_simulation,
        simulation_parameters=parameters,
    )

    logger.info(f"🚀 Invoking swarm | thread={thread_id} | trigger={trigger_source}")

    result = await graph.ainvoke(initial_state)

    logger.info(f"✅ Swarm execution complete | thread={thread_id}")
    return result
