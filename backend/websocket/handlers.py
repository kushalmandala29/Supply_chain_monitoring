"""
WebSocket Event Handlers
==========================
Processes incoming WebSocket messages from the frontend client.
Dispatches queries and scenarios to the LangGraph swarm and streams results back.
"""

from __future__ import annotations

import logging
from typing import Any

from backend.graph.builder import invoke_swarm
from backend.websocket.manager import ConnectionManager

logger = logging.getLogger("scri.ws.handlers")


async def handle_ws_message(
    manager: ConnectionManager,
    client_id: str,
    message: dict[str, Any],
    swarm_graph: Any,
) -> None:
    """
    Handle an incoming WebSocket message from the client.

    Supported message types:
        - query: Submit an analyst query to the swarm.
        - scenario: Inject a What-If scenario simulation.
        - ping: Connection keepalive.
    """
    msg_type = message.get("type", "")
    payload = message.get("payload", {})

    logger.info(f"📥 WS message from {client_id}: type={msg_type}")

    if msg_type == "ping":
        await manager.send_to_client(client_id, {"type": "pong", "payload": {}})

    elif msg_type == "query":
        await _handle_query(manager, client_id, payload, swarm_graph)

    elif msg_type == "scenario":
        await _handle_scenario(manager, client_id, payload, swarm_graph)

    else:
        await manager.send_to_client(client_id, {
            "type": "error",
            "payload": {"message": f"Unknown message type: {msg_type}"},
        })


async def _handle_query(
    manager: ConnectionManager,
    client_id: str,
    payload: dict[str, Any],
    swarm_graph: Any,
) -> None:
    """Process an analyst query through the swarm."""
    query = payload.get("query", "")
    coordinates = payload.get("coordinates")

    # Notify client that processing has started
    await manager.send_to_client(client_id, {
        "type": "agent_trace",
        "agent": "supervisor",
        "payload": {"content": f"🧠 Processing query: {query[:100]}..."},
    })

    try:
        result = await invoke_swarm(
            graph=swarm_graph,
            query=query,
            trigger_source="analyst_query",
            coordinates=coordinates,
        )

        # Send layout update
        await manager.send_layout_update(client_id, result.get("target_ui_schema", {}))

        # Send final results
        await manager.send_to_client(client_id, {
            "type": "analysis_complete",
            "payload": {
                "thread_id": result.get("thread_id", ""),
                "risk_summary": result.get("risk_summary", ""),
                "financial_impact": result.get("financial_impact_kpis", {}),
                "agents_invoked": result.get("agents_invoked", []),
                "confidence": result.get("confidence_score", 0.0),
            },
        })

    except Exception as e:
        logger.error(f"📥 Query processing error: {e}")
        await manager.send_to_client(client_id, {
            "type": "error",
            "payload": {"message": str(e)},
        })


async def _handle_scenario(
    manager: ConnectionManager,
    client_id: str,
    payload: dict[str, Any],
    swarm_graph: Any,
) -> None:
    """Process a What-If scenario injection."""
    description = payload.get("scenario_description", "")
    parameters = payload.get("parameters", {})
    coordinates = payload.get("coordinates")

    await manager.send_to_client(client_id, {
        "type": "agent_trace",
        "agent": "supervisor",
        "payload": {"content": f"🔮 Simulating: {description[:100]}..."},
    })

    try:
        result = await invoke_swarm(
            graph=swarm_graph,
            query=description,
            trigger_source="synthetic_simulation",
            coordinates=coordinates,
            parameters=parameters,
        )

        await manager.send_layout_update(client_id, result.get("target_ui_schema", {}))

        await manager.send_to_client(client_id, {
            "type": "simulation_complete",
            "payload": {
                "thread_id": result.get("thread_id", ""),
                "risk_summary": result.get("risk_summary", ""),
                "financial_impact": result.get("financial_impact_kpis", {}),
            },
        })

    except Exception as e:
        logger.error(f"📥 Scenario processing error: {e}")
        await manager.send_to_client(client_id, {
            "type": "error",
            "payload": {"message": str(e)},
        })
