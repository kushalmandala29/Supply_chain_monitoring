"""Redis Streams client shared by all agents. Each agent type reads
query.received through its own consumer group, so the same message fans out
to every agent type the Query Router activated, independently and without
blocking one another.
"""
import json
import logging
from typing import Any

import redis.asyncio as redis

logger = logging.getLogger(__name__)


class StreamBus:
    def __init__(self, redis_url: str, streams: dict[str, str]) -> None:
        self._redis = redis.from_url(redis_url, decode_responses=True)
        self._streams = streams

    def stream(self, key: str) -> str:
        return self._streams[key]

    async def ensure_group(self, stream_key: str, group: str) -> None:
        stream = self.stream(stream_key)
        try:
            await self._redis.xgroup_create(stream, group, id="0", mkstream=True)
        except redis.ResponseError as exc:
            if "BUSYGROUP" not in str(exc):
                raise

    async def publish(self, stream_key: str, payload: dict[str, Any]) -> str:
        return await self._redis.xadd(self.stream(stream_key), {"data": json.dumps(payload)})

    async def read(self, stream_key: str, last_id: str = "$", block_ms: int = 5000):
        """Plain XREAD (no consumer group) -- for observing a stream without
        competing with the group of agents actually responsible for it."""
        stream = self.stream(stream_key)
        result = await self._redis.xread({stream: last_id}, block=block_ms, count=10)
        for _stream_name, messages in result:
            for message_id, fields in messages:
                yield message_id, json.loads(fields["data"])

    async def consume(self, stream_key: str, group: str, consumer: str, block_ms: int = 5000):
        stream = self.stream(stream_key)
        await self.ensure_group(stream_key, group)
        while True:
            result = await self._redis.xreadgroup(
                group, consumer, {stream: ">"}, count=10, block=block_ms
            )
            for _stream_name, messages in result:
                for message_id, fields in messages:
                    yield message_id, json.loads(fields["data"])
                    await self._redis.xack(stream, group, message_id)

    async def close(self) -> None:
        await self._redis.aclose()
