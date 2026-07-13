"""WebSocket endpoint: the frontend's single connection for both submitting
queries and receiving progressive results from agents.

Pattern:
  1. Client sends {"query": "..."}.
  2. Gateway resolves intent/agents (query_router) and publishes to
     query.received on the shared blackboard.
  3. Gateway forwards every subsequent message on the result streams
     (agent.status, news.ingested, weather.updated, satellite.ready,
     route.recomputed, risk.detected, explanation.updated, ...) whose
     session_id matches this connection, as soon as an agent publishes it --
     no waiting for all agents. agent.status carries started/completed/error
     events so the frontend's Agent Trace Console can show live activity.
"""
import asyncio
import logging

from fastapi import WebSocket, WebSocketDisconnect

from app.core.config import get_platform_config
from app.core.redis_streams import StreamBus
from app.api.query_router import route_query
from app.models.query import UserQuery

logger = logging.getLogger(__name__)

RESULT_STREAM_KEYS = [
    "query_router",
    "agent_status",
    "news_ingested",
    "weather_updated",
    "commodity_updated",
    "satellite_ready",
    "route_recomputed",
    "risk_detected",
    "explanation_updated",
    "explanation_chunk",
    "map_updated",
    "kpi_update",
    "kpi_alert",
]
AMBIENT_REPLAY_STREAM_KEYS = [
    "news_ingested",
    "weather_updated",
    "commodity_updated",
    "satellite_ready",
    "risk_detected",
    "kpi_update",
    "kpi_alert",
]


async def _forward_stream(bus: StreamBus, stream_key: str, session_id: str, ws: WebSocket) -> None:
    last_id = "$"
    while True:
        async for message_id, payload in bus.read(stream_key, last_id=last_id):
            last_id = message_id
            # Ambient ETL updates carry no session_id and broadcast to every
            # connected client; per-query agent results only go to the
            # session that asked.
            payload_session_id = payload.get("session_id")
            if payload_session_id is None or payload_session_id == session_id:
                await ws.send_json({"stream": stream_key, "payload": payload})


async def _replay_recent_ambient(bus: StreamBus, ws: WebSocket) -> None:
    for stream_key in AMBIENT_REPLAY_STREAM_KEYS:
        async for _message_id, payload in bus.read_recent(stream_key):
            if payload.get("session_id") is None:
                await ws.send_json({"stream": stream_key, "payload": payload})


async def handle_connection(ws: WebSocket, session_id: str) -> None:
    await ws.accept()
    bus = StreamBus()
    await _replay_recent_ambient(bus, ws)
    forwarders = [
        asyncio.create_task(_forward_stream(bus, key, session_id, ws))
        for key in RESULT_STREAM_KEYS
    ]

    try:
        while True:
            raw = await ws.receive_json()
            user_query = UserQuery(session_id=session_id, query=raw["query"])
            await bus.publish(
                "query_submitted",
                {
                    "session_id": user_query.session_id,
                    "query": user_query.query,
                },
            )
            # The frontend expects a quick query_router response to know the active agents.
            # But now, the router agent will publish query_received. The frontend should
            # just wait for query_received (or query_router stream) which will be forwarded.
    except WebSocketDisconnect:
        logger.info("session %s disconnected", session_id)
    finally:
        for task in forwarders:
            task.cancel()
        await bus.close()


def get_map_layers() -> list[dict]:
    return get_platform_config().get("map_layers", [])
