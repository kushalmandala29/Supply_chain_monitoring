"""Base class for every agent: listen on query.received, act only on queries
the Query Router addressed to this agent's name, publish the result on this
agent's own output stream. Agents never call each other directly -- everything
flows through the shared blackboard (Redis Streams).
"""
import asyncio
import logging
import time
from abc import ABC, abstractmethod
from typing import Any

from .config import get_agent_settings, get_platform_config
from .stream_bus import StreamBus

logger = logging.getLogger(__name__)


class BaseAgent(ABC):
    name: str
    output_stream_key: str

    def __init__(self) -> None:
        settings = get_agent_settings()
        streams = get_platform_config().get("redis_streams", {})
        self.bus = StreamBus(settings.redis_url, streams)
        self.consumer_group_prefix = streams.get("consumer_group", "agents")

    @abstractmethod
    async def handle(self, routed_query: dict[str, Any]) -> dict[str, Any] | None:
        """Process a routed query. Return the payload to publish on this
        agent's output stream, or None to publish nothing."""

    async def run(self) -> None:
        logger.info("[%s] listening on query.received", self.name.upper())
        group = f"{self.consumer_group_prefix}.{self.name}"
        async for _message_id, payload in self.bus.consume(
            "query_received", group=group, consumer=self.name
        ):
            if self.name not in payload.get("agents", []):
                continue
            session_id = payload.get("session_id")
            query = payload.get("query")
            logger.info("[%s] handling query: %r", self.name.upper(), query)

            await self._publish_status(session_id, query, "started")
            start = time.monotonic()
            try:
                result = await self.handle(payload)
            except Exception as exc:  # noqa: BLE001 -- one bad query shouldn't kill the agent
                logger.exception("[%s] failed handling query: %r", self.name.upper(), query)
                elapsed_ms = round((time.monotonic() - start) * 1000)
                await self._publish_status(session_id, query, "error", detail=str(exc), elapsed_ms=elapsed_ms)
                continue

            elapsed_ms = round((time.monotonic() - start) * 1000)
            if result is not None:
                result.setdefault("session_id", session_id)
                result.setdefault("elapsed_ms", elapsed_ms)
                await self.bus.publish(self.output_stream_key, result)
            await self._publish_status(session_id, query, "completed", elapsed_ms=elapsed_ms)

    async def _publish_status(
        self,
        session_id: str | None,
        query: str | None,
        status: str,
        detail: str | None = None,
        elapsed_ms: int | None = None,
    ) -> None:
        """Publishes to the shared agent.status stream so the frontend's Agent
        Trace Console can show real-time activity (including how long each
        agent took), not just final results."""
        status_payload = {"agent": self.name, "session_id": session_id, "query": query, "status": status}
        if detail:
            status_payload["detail"] = detail
        if elapsed_ms is not None:
            status_payload["elapsed_ms"] = elapsed_ms
        await self.bus.publish("agent_status", status_payload)

    async def close(self) -> None:
        await self.bus.close()


def run_agent(agent: BaseAgent) -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
    try:
        asyncio.run(agent.run())
    finally:
        asyncio.run(agent.close())
