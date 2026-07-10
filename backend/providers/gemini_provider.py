"""
Google Gemini LLM Provider
============================
HTTP client for the Google Gemini API.
Supports Gemini 1.5 Flash (text tasks) and Gemini 1.5 Pro (multimodal/vision).
"""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from backend.config import settings

logger = logging.getLogger("scri.provider.gemini")


class GeminiProvider:
    """Google Gemini API provider for 1.5 Flash and 1.5 Pro models."""

    def __init__(self) -> None:
        self.base_url = settings.gemini.api_base_url
        self.api_key = settings.gemini.api_key
        self._client = httpx.AsyncClient(timeout=60.0)

    async def chat_completion(
        self,
        messages: list[dict[str, str]],
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        response_format: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        """
        Send a chat completion request to the Gemini API.

        Args:
            messages: List of message dictionaries with 'role' and 'content'.
            model: Model identifier (default: gemini-1.5-flash).
            temperature: Sampling temperature.
            max_tokens: Maximum tokens in the response.
            response_format: Optional response format specification.

        Returns:
            Dictionary with 'content' (raw text) and 'parsed' (JSON if applicable).
        """
        model = model or settings.gemini.flash_model
        url = f"{self.base_url}/models/{model}:generateContent"

        # Convert OpenAI-style messages to Gemini format
        contents = self._convert_messages(messages)

        payload: dict[str, Any] = {
            "contents": contents,
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens,
            },
        }

        if response_format and response_format.get("type") == "json_object":
            payload["generationConfig"]["responseMimeType"] = "application/json"

        try:
            response = await self._client.post(
                url,
                json=payload,
                params={"key": self.api_key},
            )
            response.raise_for_status()
            data = response.json()

            # Extract content from Gemini response format
            candidates = data.get("candidates", [])
            content = ""
            if candidates:
                parts = candidates[0].get("content", {}).get("parts", [])
                content = parts[0].get("text", "") if parts else ""

            usage_meta = data.get("usageMetadata", {})
            logger.info(
                f"💎 Gemini [{model}] — "
                f"tokens: {usage_meta.get('totalTokenCount', 'N/A')}"
            )

            # Attempt JSON parsing
            parsed = {}
            if response_format and response_format.get("type") == "json_object":
                try:
                    parsed = json.loads(content)
                except json.JSONDecodeError:
                    logger.warning("💎 Gemini response was not valid JSON")

            return {"content": content, "parsed": parsed, "usage": usage_meta}

        except httpx.HTTPStatusError as e:
            logger.error(f"💎 Gemini HTTP error: {e.response.status_code}")
            raise
        except Exception as e:
            logger.error(f"💎 Gemini error: {e}")
            raise

    def _convert_messages(self, messages: list[dict[str, str]]) -> list[dict[str, Any]]:
        """Convert OpenAI-style messages to Gemini content format."""
        contents = []
        system_instruction = ""

        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")

            if role == "system":
                system_instruction = content
                continue

            gemini_role = "user" if role == "user" else "model"

            # Prepend system instruction to first user message
            if gemini_role == "user" and system_instruction:
                content = f"{system_instruction}\n\n{content}"
                system_instruction = ""

            contents.append({
                "role": gemini_role,
                "parts": [{"text": content}],
            })

        return contents

    async def close(self) -> None:
        """Close the HTTP client."""
        await self._client.aclose()
