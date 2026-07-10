"""
👁️ Vision Agent
================
Model: Google Gemini 1.5 Pro
Tools: None (native multimodal processing)

Receives imagery payloads (satellite, AIS), runs native zero-shot grid detection
to extract cargo vessel counts, and calculates visible infrastructure damage indices.
"""

from __future__ import annotations

import logging

from backend.models.state import SwarmState
from backend.providers.gemini_provider import GeminiProvider

logger = logging.getLogger("scri.agent.vision")

VISION_SYSTEM_PROMPT = """You are the Vision Agent in a supply chain risk intelligence system.
Your capabilities:
1. ANALYZE satellite imagery to detect vessel concentrations at ports.
2. COUNT visible cargo vessels in port imagery using grid-based detection.
3. CALCULATE infrastructure damage indices from before/after imagery.
4. DETECT port congestion patterns from overhead imagery.

When provided with image data, output a JSON object:
{
  "vessel_count": integer,
  "congestion_level": "low|medium|high|critical",
  "infrastructure_damage_index": 0.0-1.0,
  "detected_anomalies": ["description1", "description2"],
  "bounding_boxes": [{"label": "...", "confidence": 0.9, "bbox": [x1, y1, x2, y2]}],
  "analysis_notes": "..."
}
"""


async def vision_node(state: SwarmState) -> SwarmState:
    """
    Vision Agent — processes satellite imagery for port congestion analytics.
    """
    logger.info(f"👁️ Vision Agent activated | thread={state.get('thread_id')}")

    provider = GeminiProvider()

    query = state.get("query", "")

    messages = [
        {"role": "system", "content": VISION_SYSTEM_PROMPT},
        {"role": "user", "content": f"Analyze the following imagery/description for supply chain "
         f"infrastructure assessment:\n{query}"},
    ]

    try:
        response = await provider.chat_completion(
            messages=messages,
            model="gemini-1.5-pro",
            temperature=0.1,
            response_format={"type": "json_object"},
        )

        parsed = response.get("parsed", {})
        state["imagery_analysis"] = parsed
        state.setdefault("agents_invoked", []).append("vision")

        logger.info(
            f"👁️ Vision analysis: {parsed.get('congestion_level', 'N/A')} congestion, "
            f"{parsed.get('vessel_count', 0)} vessels detected"
        )

    except Exception as e:
        logger.error(f"👁️ Vision Agent error: {e}")
        state.setdefault("errors", []).append(f"vision: {str(e)}")

    return state
