import json
import logging
import sys
from pathlib import Path
from typing import Any

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from common.base_agent import BaseAgent, run_agent
from common.config import get_agent_settings, get_platform_config

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are the intent router for Jarvis Supply Chain Intelligence.
Your job is to analyze the user's query and decide which background agents need to be activated.

Available specialized agents:
- intel: searches global news/weather/events to find disruptions.
- logistics: computes routing, ETA, and shipping lanes.
- commodity: checks real-time market prices for raw materials.
- spatial: computes KPI-weighted compounded operational/weather/geographic risk for facilities and geofences.
- vision: fetches satellite imagery for a queried region (storms, cloud cover, ocean conditions).
- mapper: ALWAYS include this agent so it can plot articles on the map.
- synthesizer: ALWAYS include this agent to generate the final streaming explanation.

Include "spatial" for queries about risk zones, operational risk, or compounded/weighted risk scoring.
Include "vision" for queries about satellite imagery, storm tracking, cloud cover, or visual conditions at a location.

Output exactly a JSON object containing a list of strings called "agents" (do not use markdown).
Example:
{"agents": ["intel", "mapper", "synthesizer"]}
"""

class RouterAgent(BaseAgent):
    name = "router"
    output_stream_key = "query_received"
    
    def __init__(self) -> None:
        super().__init__()

    async def handle(self, routed_query: dict[str, Any]) -> dict[str, Any] | None:
        pass

    async def run(self) -> None:
        """Override run to listen to query_submitted instead of query_received"""
        stream_key = "query_submitted"
        logger.info("[%s] Listening on %s...", self.name.upper(), stream_key)
        
        last_id = "$"
        while True:
            try:
                async for message_id, payload in self.bus.read(stream_key, last_id=last_id, block_ms=5000):
                    last_id = message_id
                    await self._handle_submission(payload)
            except Exception:
                logger.exception("[%s] stream read error", self.name.upper())

    async def _handle_submission(self, payload: dict[str, Any]) -> None:
        query = payload.get("query")
        session_id = payload.get("session_id")
        if not query or not session_id:
            return

        logger.info("[ROUTER] Analyzing query: %r", query)
        
        agents = ["mapper", "synthesizer"] # Always include by default
        intent = "custom"
        
        try:
            agents_result = await self._invoke_llm(query)
            if agents_result:
                # Ensure mapper and synthesizer are always included
                agents_set = set(agents_result)
                agents_set.update(["mapper", "synthesizer"])
                agents = list(agents_set)
        except Exception as e:
            logger.error("[ROUTER] LLM routing failed: %s", e)
            # fallback -- "spatial" is cheap (reads already-cached kpi.update
            # broadcasts, no external API) so it's safe to always include;
            # "vision" hits an external imagery API and stays LLM-gated only.
            agents = ["intel", "logistics", "spatial", "mapper", "synthesizer"]
            
        logger.info("[ROUTER] Activated agents: %s", agents)
        
        # Publish to query_received which kicks off the specialized agents
        await self.bus.publish(
            "query_received",
            {
                "session_id": session_id,
                "query": query,
                "intent": intent,
                "agents": agents,
            },
        )
        # Also publish to query_router stream so frontend activeAgents updates
        await self.bus.publish(
            "query_router",
            {
                "session_id": session_id,
                "query": query,
                "intent": intent,
                "agents": agents,
            },
        )

    async def _invoke_llm(self, query: str) -> list[str]:
        settings = get_agent_settings()
        if not settings.openrouter_api_key:
            return []

        headers = {
            "Authorization": f"Bearer {settings.openrouter_api_key}",
            "HTTP-Referer": "http://localhost",
            "X-Title": "Jarvis",
            "Content-Type": "application/json",
        }
        payload = {
            "model": settings.openrouter_model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": query},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.0,
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{settings.openrouter_base_url.rstrip('/')}/chat/completions",
                headers=headers,
                json=payload,
            )
            response.raise_for_status()
            content = response.json()["choices"][0]["message"]["content"]
            try:
                parsed = json.loads(content)
                return parsed.get("agents", [])
            except json.JSONDecodeError:
                return []

if __name__ == "__main__":
    run_agent(RouterAgent())
