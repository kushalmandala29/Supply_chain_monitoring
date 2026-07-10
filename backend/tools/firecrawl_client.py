"""
Firecrawl MCP Client
=====================
Web-to-Markdown extraction tool used by the Intelligence and Geopolitical agents.
Converts unstructured web pages into clean, LLM-ready markdown.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from backend.config import settings

logger = logging.getLogger("scri.tools.firecrawl")


class FirecrawlClient:
    """Client for the Firecrawl MCP server."""

    def __init__(self) -> None:
        self.api_key = settings.mcp.firecrawl_api_key
        self.api_url = settings.mcp.firecrawl_api_url
        self._client = httpx.AsyncClient(
            base_url=self.api_url,
            headers={"Authorization": f"Bearer {self.api_key}"},
            timeout=30.0,
        )

    async def scrape_url(self, url: str, formats: list[str] | None = None) -> str:
        """
        Scrape a URL and return clean markdown content.

        Args:
            url: Target URL to scrape.
            formats: Output formats (default: ['markdown']).

        Returns:
            Cleaned markdown content.
        """
        payload: dict[str, Any] = {
            "url": url,
            "formats": formats or ["markdown"],
        }

        try:
            response = await self._client.post("/v1/scrape", json=payload)
            response.raise_for_status()
            data = response.json()
            content = data.get("data", {}).get("markdown", "")
            logger.info(f"🔥 Firecrawl scraped {url} ({len(content)} chars)")
            return content

        except httpx.HTTPStatusError as e:
            logger.error(f"🔥 Firecrawl HTTP error for {url}: {e.response.status_code}")
            raise
        except Exception as e:
            logger.error(f"🔥 Firecrawl error for {url}: {e}")
            raise

    async def crawl_site(self, url: str, max_pages: int = 5) -> list[dict[str, Any]]:
        """
        Crawl a website and return multiple pages as markdown.

        Args:
            url: Starting URL for the crawl.
            max_pages: Maximum number of pages to crawl.

        Returns:
            List of page data dictionaries.
        """
        payload = {
            "url": url,
            "limit": max_pages,
            "scrapeOptions": {"formats": ["markdown"]},
        }

        try:
            response = await self._client.post("/v1/crawl", json=payload)
            response.raise_for_status()
            data = response.json()
            pages = data.get("data", [])
            logger.info(f"🔥 Firecrawl crawled {url} ({len(pages)} pages)")
            return pages

        except Exception as e:
            logger.error(f"🔥 Firecrawl crawl error for {url}: {e}")
            raise

    async def close(self) -> None:
        """Close the HTTP client."""
        await self._client.aclose()
