"""
🕵️ Intelligence Agent
======================
Model: Google Gemini 1.5 Flash
Tools: Firecrawl MCP

Normalizes incoming raw text telemetry, extracts structured entities
(Ports, Nodes, Cargo, Vessels), and isolates actionable claims from noise.
"""

from __future__ import annotations

import logging

from backend.models.state import SwarmState
from backend.providers.gemini_provider import GeminiProvider
from backend.tools.firecrawl_client import FirecrawlClient

logger = logging.getLogger("scri.agent.intelligence")

INTELLIGENCE_SYSTEM_PROMPT = """You are the Intelligence Agent in a supply chain risk system.
Your responsibilities:
1. EXTRACT structured entities from raw text: ports, shipping nodes, cargo types, vessels, routes.
2. ISOLATE specific claims with confidence scores.
3. NORMALIZE inconsistent data formats into structured JSON.
4. FLAG ambiguous or conflicting information for downstream verification.

Output a JSON object:
{
  "entities": [
    {"entity_type": "port|node|cargo|vessel|route", "name": "...", "confidence": 0.95, 
     "coordinates": [lat, lng] or null, "metadata": {...}}
  ],
  "claims": [
    {"claim": "...", "source": "...", "confidence": 0.85, "requires_verification": true}
  ],
  "data_quality_score": 0.0-1.0
}
"""


async def intelligence_node(state: SwarmState) -> SwarmState:
    """
    Intelligence Agent — NER extraction and claim isolation from raw telemetry.
    """
    logger.info(f"🕵️ Intelligence Agent activated | thread={state.get('thread_id')}")

    provider = GeminiProvider()
    firecrawl = FirecrawlClient()

    query = state.get("query", "")
    raw_content = query

    # If the query contains URLs, fetch content via Firecrawl MCP
    urls = _extract_urls(query)
    if urls:
        for url in urls[:3]:  # Cap at 3 URLs to conserve tokens
            try:
                scraped = await firecrawl.scrape_url(url)
                raw_content += f"\n\n--- Source: {url} ---\n{scraped}"
            except Exception as e:
                logger.warning(f"🕵️ Firecrawl failed for {url}: {e}")

    messages = [
        {"role": "system", "content": INTELLIGENCE_SYSTEM_PROMPT},
        {"role": "user", "content": f"Analyze and extract entities from:\n{raw_content}"},
    ]

    try:
        response = await provider.chat_completion(
            messages=messages,
            model="gemini-1.5-flash",
            temperature=0.1,
            response_format={"type": "json_object"},
        )

        parsed = response.get("parsed", {})
        state["extracted_entities"] = parsed.get("entities", [])
        state.setdefault("agents_invoked", []).append("intelligence")

        logger.info(f"🕵️ Extracted {len(state['extracted_entities'])} entities")

    except Exception as e:
        logger.error(f"🕵️ Intelligence Agent error: {e}")
        state.setdefault("errors", []).append(f"intelligence: {str(e)}")

    return state


def _extract_urls(text: str) -> list[str]:
    """Extract HTTP/HTTPS URLs from text."""
    import re
    return re.findall(r'https?://[^\s<>"{}|\\^`\[\]]+', text)
