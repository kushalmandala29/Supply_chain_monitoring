"""Supervisor Agent: the PRD Narrative Agent.

It waits for sibling agents addressed by the Query Router, merges their
findings with live web search, resolves a map location, and asks a low-cost
OpenRouter model for concise operational guidance.
"""
import asyncio
import logging
import re
import sys
import time
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse

import httpx
from bs4 import BeautifulSoup

# Makes `agents/common` importable whether this runs from Docker (where it's
# copied in as a sibling of main.py) or natively from the repo (where it's
# one level up, under agents/).
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from common.base_agent import BaseAgent, run_agent
from common.config import get_agent_settings

logger = logging.getLogger(__name__)

NOMINATIM_USER_AGENT = "jarvis-supply-chain-intelligence/0.1"
SEARCH_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)

SIBLING_OUTPUT_STREAMS = {
    "intel": "news_ingested",
    "spatial": "risk_detected",
    "vision": "satellite_ready",
    "logistics": "route_recomputed",
    "commodity": "commodity_updated",
}
SIBLING_WAIT_TIMEOUT_S = 12.0

_QUERY_STOPWORDS = {
    "tell", "me", "about", "whats", "what", "happening", "the", "a", "an", "is", "are",
    "was", "were", "how", "why", "when", "who", "which", "this", "that",
    "show", "give", "recent", "events", "event", "risk", "zone", "status",
    "of", "for", "to", "and", "or", "on", "at", "with", "from", "affecting",
    "near", "around", "please", "can", "you", "need", "know", "details",
    "detail", "explain", "describe", "shipping", "route", "world",
}
_GENERIC_ALONE = {
    "port", "sea", "bay", "gulf", "strait", "coast", "island", "zone",
    "route", "refinery", "terminal", "harbor", "harbour", "channel",
    "canal", "south", "north", "east", "west", "new", "congestion",
}


def _content_runs(text: str) -> list[str]:
    cleaned = re.sub(r"[^\w\s]", " ", text.replace("'", ""))
    words = cleaned.split()
    runs: list[str] = []
    current: list[str] = []
    for word in words:
        if word.lower() in _QUERY_STOPWORDS or len(word) < 3:
            if current:
                runs.append(" ".join(current))
                current = []
        else:
            current.append(word)
    if current:
        runs.append(" ".join(current))
    return runs


def _geocode_candidates(text: str) -> list[str]:
    runs = _content_runs(text)
    ordered = sorted(runs, key=lambda r: -len(r.split()))
    seen: set[str] = set()
    candidates = [text]
    for run in ordered:
        words_in_run = run.split()
        if len(words_in_run) == 1 and words_in_run[0].lower() in _GENERIC_ALONE:
            continue
        if run.lower() not in seen:
            seen.add(run.lower())
            candidates.append(run)
    for run in runs:
        for word in run.split():
            if word.lower() not in seen and word.lower() not in _GENERIC_ALONE:
                seen.add(word.lower())
                candidates.append(word)
    return candidates[:6]


def _unwrap_duckduckgo_redirect(href: str) -> str:
    parsed = urlparse(href)
    if parsed.path == "/l/":
        query = parse_qs(parsed.query)
        if "uddg" in query:
            return unquote(query["uddg"][0])
    return href


class SupervisorAgent(BaseAgent):
    name = "supervisor"
    output_stream_key = "explanation_updated"

    async def handle(self, routed_query: dict[str, Any]) -> dict[str, Any] | None:
        query = routed_query["query"]
        session_id = routed_query.get("session_id")
        settings = get_agent_settings()

        sibling_agents = [a for a in routed_query.get("agents", []) if a != self.name]
        sibling_results, sources = await asyncio.gather(
            self._collect_sibling_results(session_id, sibling_agents),
            self._web_search(query),
        )

        location = await self._resolve_location(query, sibling_results)
        explanation = await self._synthesize(query, sources, sibling_results, settings)

        return {
            "query": query,
            "explanation": explanation,
            "sources": sources,
            "location": location,
            "agents_consulted": list(sibling_results.keys()),
        }

    async def _collect_sibling_results(
        self, session_id: str | None, sibling_agents: list[str]
    ) -> dict[str, Any]:
        deadline = time.monotonic() + SIBLING_WAIT_TIMEOUT_S
        stream_keys = {a: SIBLING_OUTPUT_STREAMS[a] for a in sibling_agents if a in SIBLING_OUTPUT_STREAMS}
        if not stream_keys:
            return {}
        tasks = {
            agent: asyncio.create_task(self._wait_for_result(stream_key, session_id, deadline))
            for agent, stream_key in stream_keys.items()
        }
        results = await asyncio.gather(*tasks.values())
        return {agent: result for agent, result in zip(tasks.keys(), results) if result is not None}

    async def _wait_for_result(
        self, stream_key: str, session_id: str | None, deadline: float
    ) -> dict[str, Any] | None:
        last_id = "$"
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                return None
            async for message_id, payload in self.bus.read(
                stream_key, last_id=last_id, block_ms=max(1, int(remaining * 1000))
            ):
                last_id = message_id
                if payload.get("session_id") == session_id:
                    return payload
            if time.monotonic() >= deadline:
                return None

    async def _web_search(self, query: str) -> list[dict[str, Any]]:
        headers = {
            "User-Agent": SEARCH_USER_AGENT,
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://html.duckduckgo.com/",
        }
        try:
            async with httpx.AsyncClient(timeout=10.0, headers=headers) as client:
                response = await client.post("https://html.duckduckgo.com/html/", data={"q": query})
            response.raise_for_status()
        except httpx.HTTPError:
            return []

        soup = BeautifulSoup(response.text, "html.parser")
        results = []
        for result in soup.select(".result__body")[:5]:
            title_el = result.select_one(".result__a")
            if not title_el:
                continue
            snippet_el = result.select_one(".result__snippet")
            results.append(
                {
                    "title": title_el.get_text(strip=True),
                    "url": _unwrap_duckduckgo_redirect(title_el.get("href", "")),
                    "content": snippet_el.get_text(strip=True) if snippet_el else "",
                }
            )
        return results

    async def _resolve_location(
        self, query: str, sibling_results: dict[str, Any]
    ) -> dict[str, Any] | None:
        for result in sibling_results.values():
            location = result.get("location")
            if location and "lat" in location and "lon" in location:
                return location
            for article in result.get("articles", []):
                article_location = article.get("location") if isinstance(article, dict) else None
                if article_location and "lat" in article_location and "lon" in article_location:
                    return article_location
        return await self._geocode(query)

    async def _geocode(self, text: str) -> dict[str, Any] | None:
        async with httpx.AsyncClient(timeout=10.0, headers={"User-Agent": NOMINATIM_USER_AGENT}) as client:
            for candidate in _geocode_candidates(text):
                try:
                    response = await client.get(
                        "https://nominatim.openstreetmap.org/search",
                        params={"q": candidate, "format": "jsonv2", "limit": 1},
                    )
                    response.raise_for_status()
                    results = response.json()
                except httpx.HTTPError:
                    results = []
                await asyncio.sleep(1)
                if results:
                    top = results[0]
                    return {"lat": float(top["lat"]), "lon": float(top["lon"]), "label": top.get("display_name")}
        return None

    async def _synthesize(
        self,
        query: str,
        sources: list[dict[str, Any]],
        sibling_results: dict[str, Any],
        settings,
    ) -> str:
        context_parts = []
        for agent, result in sibling_results.items():
            context_parts.append(f"{agent.title()} Agent findings: {self._summarize_agent_payload(result)}")
        if sources:
            context_parts.append(
                "Web search results:\n"
                + "\n".join(f"- {s['title']}: {s['content']}" for s in sources if s.get("content"))
            )
        context = "\n\n".join(context_parts) or "No additional context available."

        try:
            return await self._invoke_openrouter(query, context, settings)
        except Exception as exc:  # noqa: BLE001 -- degrade gracefully, don't drop what we gathered
            logger.warning("[SUPERVISOR] OpenRouter call failed: %s", exc)
            return self._fallback_synthesis(query, context_parts, exc)

    @staticmethod
    def _summarize_agent_payload(result: dict[str, Any]) -> str:
        if result.get("summary") or result.get("note"):
            return str(result.get("summary") or result.get("note"))
        if isinstance(result.get("articles"), list):
            titles = [a.get("title") for a in result["articles"][:3] if isinstance(a, dict) and a.get("title")]
            if titles:
                return "Recent mapped articles: " + "; ".join(titles)
        if isinstance(result.get("alerts"), list) and result["alerts"]:
            return f"{len(result['alerts'])} active alert(s)."
        if isinstance(result.get("prices"), list) and result["prices"]:
            return f"{len(result['prices'])} commodity price update(s)."
        return str(result)[:700]

    async def _invoke_openrouter(self, query: str, context: str, settings) -> str:
        if not settings.openrouter_api_key:
            raise ValueError("OPENROUTER_API_KEY is not set")

        headers = {
            "Authorization": f"Bearer {settings.openrouter_api_key}",
            "Content-Type": "application/json",
        }
        if settings.openrouter_site_url:
            headers["HTTP-Referer"] = settings.openrouter_site_url
        if settings.openrouter_app_title:
            headers["X-OpenRouter-Title"] = settings.openrouter_app_title

        payload = {
            "model": settings.openrouter_model,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are the Supervisor Agent for a supply-chain intelligence platform. "
                        "Act like an operations lead: synthesize specialist-agent findings and web "
                        "sources into concise, factual, decision-ready guidance. Prioritize supply "
                        "chain impact, mapped locations, likely affected transport/supplier flows, "
                        "confidence, and immediate actions. Do not invent facts; say what is unknown."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Question: {query}\n\nCollected context:\n{context}\n\n"
                        "Return exactly these sections: Situation, Supply-chain impact, "
                        "Recommended actions, Confidence."
                    ),
                },
            ],
            "temperature": 0.2,
            "max_tokens": 700,
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{settings.openrouter_base_url.rstrip('/')}/chat/completions",
                headers=headers,
                json=payload,
            )
        response.raise_for_status()
        data = response.json()
        return self._extract_openrouter_text(data)

    @staticmethod
    def _extract_openrouter_text(data: dict[str, Any]) -> str:
        choices = data.get("choices") or []
        if not choices:
            raise ValueError("OpenRouter response had no choices")

        choice = choices[0]
        message = choice.get("message") or {}

        # --- Primary: standard content field ---
        content = message.get("content")
        if content is not None:
            if isinstance(content, str):
                stripped = content.strip()
                if stripped:
                    return stripped
            elif isinstance(content, list):
                text_parts = [
                    str(part.get("text", ""))
                    for part in content
                    if isinstance(part, dict) and part.get("text") is not None
                ]
                text = "\n".join(p.strip() for p in text_parts if p.strip())
                if text:
                    return text

        # --- Fallback: reasoning models (DeepSeek, Qwen, nex-n2-mini) store
        #     the visible output in reasoning_content or reasoning instead of
        #     content, which may be null / empty. ---
        for key in ("reasoning_content", "reasoning"):
            value = message.get(key)
            if value is not None and isinstance(value, str):
                stripped = value.strip()
                if stripped:
                    return stripped

        # --- Last resort: some providers embed text at the top-level choice ---
        top_text = choice.get("text")
        if top_text is not None and isinstance(top_text, str) and top_text.strip():
            return top_text.strip()

        finish_reason = choice.get("finish_reason")
        raise ValueError(f"OpenRouter response had no text content (finish_reason={finish_reason!r}, keys={list(message.keys())})")

    @staticmethod
    def _fallback_synthesis(query: str, context_parts: list[str], exc: Exception) -> str:
        if not context_parts:
            return (
                f"Situation: I could not gather enough live context for {query!r}.\n"
                "Supply-chain impact: Unknown until live feeds return data.\n"
                "Recommended actions: Check ETL/API keys and retry the query.\n"
                f"Confidence: Low. LLM synthesis failed: {exc}."
            )
        return (
            f"Situation: Gathered {len(context_parts)} source group(s) for {query!r}, "
            "but OpenRouter synthesis failed.\n"
            "Supply-chain impact: Review the source snippets in the trace; prioritize any "
            "port, route, supplier, weather, or commodity disruption mentioned there.\n"
            "Recommended actions: Verify OPENROUTER_API_KEY/OPENROUTER_MODEL in .env, keep "
            "watching the mapped live feed, and rerun once the model call succeeds.\n"
            f"Confidence: Medium on source collection, low on final synthesis. Error: {exc}."
        )


if __name__ == "__main__":
    run_agent(SupervisorAgent())
