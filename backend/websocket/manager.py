"""
WebSocket Connection Manager
===============================
Manages active WebSocket connections with client tracking,
broadcast capabilities, and 10-minute ping loop per spec §9.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from fastapi import WebSocket

from backend.config import settings

logger = logging.getLogger("scri.ws.manager")


class ConnectionManager:
    """Manages WebSocket connections for real-time agent trace streaming."""

    def __init__(self) -> None:
        self._active_connections: dict[str, WebSocket] = {}
        self._ping_tasks: dict[str, asyncio.Task] = {}

    async def connect(self, websocket: WebSocket, client_id: str) -> None:
        """Accept a new WebSocket connection and start ping loop."""
        await websocket.accept()
        self._active_connections[client_id] = websocket

        # Start 10-minute ping loop to keep connection alive (spec §9)
        ping_task = asyncio.create_task(self._ping_loop(client_id))
        self._ping_tasks[client_id] = ping_task

        logger.info(f"🔌 WebSocket connected: {client_id} (total: {len(self._active_connections)})")

    def disconnect(self, client_id: str) -> None:
        """Remove a disconnected client."""
        self._active_connections.pop(client_id, None)

        # Cancel ping task
        ping_task = self._ping_tasks.pop(client_id, None)
        if ping_task:
            ping_task.cancel()

        logger.info(f"🔌 WebSocket disconnected: {client_id}")

    async def send_to_client(self, client_id: str, message: dict[str, Any]) -> None:
        """Send a JSON message to a specific client."""
        websocket = self._active_connections.get(client_id)
        if websocket:
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.warning(f"🔌 Send error to {client_id}: {e}")
                self.disconnect(client_id)

    async def broadcast(self, message: dict[str, Any]) -> None:
        """Broadcast a message to all connected clients."""
        disconnected = []
        for client_id, websocket in self._active_connections.items():
            try:
                await websocket.send_json(message)
            except Exception:
                disconnected.append(client_id)

        for client_id in disconnected:
            self.disconnect(client_id)

    async def stream_agent_trace(
        self,
        client_id: str,
        agent_name: str,
        content: str,
    ) -> None:
        """Stream an agent's cognitive trace to a client."""
        await self.send_to_client(client_id, {
            "type": "agent_trace",
            "agent": agent_name,
            "payload": {"content": content},
        })

    async def send_layout_update(
        self, client_id: str, layout_schema: dict[str, Any]
    ) -> None:
        """Send a dynamic UI layout update to a client."""
        await self.send_to_client(client_id, {
            "type": "layout_update",
            "payload": layout_schema,
        })

    async def _ping_loop(self, client_id: str) -> None:
        """
        Send periodic pings to keep the WebSocket connection alive.
        AWS API Gateway has a 2-hour idle timeout; ping every 10 minutes.
        """
        interval = settings.app.ws_ping_interval
        while client_id in self._active_connections:
            await asyncio.sleep(interval)
            try:
                websocket = self._active_connections.get(client_id)
                if websocket:
                    await websocket.send_json({"type": "pong", "payload": {}})
            except Exception:
                self.disconnect(client_id)
                break

    @property
    def active_count(self) -> int:
        """Number of active connections."""
        return len(self._active_connections)
