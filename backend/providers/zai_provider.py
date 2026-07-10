"""
Z.AI LLM Provider
===================
HTTP client for the Z.AI Chat Completions API.
Supports GLM-5.2 (flagship reasoning) and GLM-4.6 (low-latency tasks).
"""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from backend.config import settings

logger = logging.getLogger("scri.provider.zai")


class ZAIProvider:
    """Z.AI API provider for GLM-5.2 and GLM-4.6 models."""

    def __init__(self) -> None:
        self.base_url = settings.zai.api_base_url
        self.api_key = settings.zai.api_key
        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            timeout=120.0,
        )

    async def chat_completion(
        self,
        messages: list[dict[str, str]],
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        response_format: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        """
        Send a chat completion request to the Z.AI API.

        Args:
            messages: List of message dictionaries with 'role' and 'content'.
            model: Model identifier (default: glm-5.2).
            temperature: Sampling temperature.
            max_tokens: Maximum tokens in the response.
            response_format: Optional response format specification.

        Returns:
            Dictionary with 'content' (raw text) and 'parsed' (JSON if applicable).
        """
        model = model or settings.zai.default_model

        payload: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        if response_format:
            payload["response_format"] = response_format

        try:
            response = await self._client.post("/chat/completions", json=payload)
            response.raise_for_status()
            data = response.json()

            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            usage = data.get("usage", {})

            logger.info(
                f"🤖 Z.AI [{model}] — "
                f"tokens: {usage.get('total_tokens', 'N/A')}"
            )

            # Attempt to parse JSON if response_format was requested
            parsed = {}
            if response_format and response_format.get("type") == "json_object":
                try:
                    parsed = json.loads(content)
                except json.JSONDecodeError:
                    logger.warning("🤖 Z.AI response was not valid JSON")

            return {"content": content, "parsed": parsed, "usage": usage}

        except httpx.HTTPStatusError as e:
            logger.error(f"🤖 Z.AI HTTP error: {e.response.status_code} — {e.response.text}")
            raise
        except Exception as e:
            logger.error(f"🤖 Z.AI error: {e}")
            raise

    async def close(self) -> None:
        """Close the HTTP client."""
        await self._client.aclose()
