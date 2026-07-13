"""Thin wrapper around Redis Streams -- the shared blackboard that the gateway
and every agent read from / write to. Stream names come from config/settings.yaml
so adding a new stream is a config change, not a code change.
"""
import json
from typing import Any

import redis.asyncio as redis

from app.core.config import get_platform_config, get_settings


class StreamBus:
    def __init__(self) -> None:
        settings = get_settings()
        self._redis = redis.from_url(settings.redis_url, decode_responses=True)
        self._streams: dict[str, str] = get_platform_config().get("redis_streams", {})

    def stream(self, key: str) -> str:
        """Resolve a logical stream key (e.g. 'query_received') to its Redis
        stream name (e.g. 'query.received')."""
        return self._streams[key]

    async def publish(self, stream_key: str, payload: dict[str, Any]) -> str:
        return await self._redis.xadd(self.stream(stream_key), {"data": json.dumps(payload)})

    async def read(self, stream_key: str, last_id: str = "$", block_ms: int = 5000):
        result = await self._redis.xread(
            {self.stream(stream_key): last_id}, block=block_ms, count=10
        )
        for _stream_name, messages in result:
            for message_id, fields in messages:
                yield message_id, json.loads(fields["data"])

    async def read_recent(self, stream_key: str, count: int = 5):
        messages = await self._redis.xrevrange(self.stream(stream_key), count=count)
        for message_id, fields in reversed(messages):
            yield message_id, json.loads(fields["data"])

    async def close(self) -> None:
        await self._redis.aclose()
