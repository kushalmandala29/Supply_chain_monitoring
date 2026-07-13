import asyncio
import json
import logging
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from common.base_agent import BaseAgent, run_agent
from common.config import get_platform_config

logger = logging.getLogger(__name__)

class MapperAgent(BaseAgent):
    name = "mapper"
    output_stream_key = "map_updated"
    
    def __init__(self) -> None:
        super().__init__()

    async def handle(self, routed_query: dict[str, Any]) -> dict[str, Any] | None:
        pass

    async def run(self) -> None:
        """Override run to listen to multiple streams and continuously emit map.updated"""
        logger.info("[%s] Listening for news.ingested and explanation.updated...", self.name.upper())
        
        streams = {
            get_platform_config().get("redis_streams", {}).get("news_ingested", "news.ingested"): "$",
            get_platform_config().get("redis_streams", {}).get("explanation_updated", "explanation.updated"): "$",
        }
        
        while True:
            try:
                for stream_key, messages in await self.bus._redis.xread(streams, block=5000):
                    for message_id, fields in messages:
                        streams[stream_key] = message_id
                        payload = json.loads(fields["data"])
                        await self._handle_event(stream_key, payload)
            except Exception:
                logger.exception("[%s] stream read error", self.name.upper())
                await asyncio.sleep(1)

    async def _handle_event(self, stream_key: str, payload: dict[str, Any]) -> None:
        session_id = payload.get("session_id")
        
        points = []
        
        if "news" in stream_key:
            articles = payload.get("articles", [])
            for article in articles:
                if article.get("location"):
                    points.append({
                        "id": article.get("url", ""),
                        "lat": article["location"]["lat"],
                        "lon": article["location"]["lon"],
                        "type": "article",
                        "label": article.get("title", ""),
                    })
        elif "explanation" in stream_key:
            loc = payload.get("location")
            if loc:
                points.append({
                    "id": "explanation_focal",
                    "lat": loc["lat"],
                    "lon": loc["lon"],
                    "type": "focal",
                    "label": "Focal Point",
                })
        
        if points and session_id:
            logger.info("[MAPPER] Publishing %d points to map_updated", len(points))
            await self.bus.publish(
                "map_updated",
                {
                    "session_id": session_id,
                    "points": points,
                },
            )

if __name__ == "__main__":
    run_agent(MapperAgent())
