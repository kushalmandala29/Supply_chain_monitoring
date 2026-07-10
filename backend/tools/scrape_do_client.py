"""
Scrape.do MCP Client
=====================
Anti-bot proxy bypass tool used by the Logistics Agent.
Routes requests through residential proxy networks when target sites
block access via WAFs or CAPTCHAs (spec §5A Safe-Failure Protocol).
"""

from __future__ import annotations

import logging

import httpx

from backend.config import settings

logger = logging.getLogger("scri.tools.scrapedo")


class ScrapeDoClient:
    """Client for the Scrape.do anti-bot proxy MCP server."""

    def __init__(self) -> None:
        self.api_token = settings.mcp.scrapedo_api_token
        self.base_url = "https://api.scrape.do"
        self._client = httpx.AsyncClient(timeout=60.0)

    async def scrape_url(self, url: str, render_js: bool = False) -> str:
        """
        Scrape a URL via Scrape.do's residential proxy network.
        Used as fallback when Firecrawl encounters HTTP 403 / WAF blocks.

        Args:
            url: Target URL that is blocked by WAF/CAPTCHA.
            render_js: Whether to render JavaScript (slower but more complete).

        Returns:
            Raw HTML content from the target page.
        """
        params = {
            "token": self.api_token,
            "url": url,
            "render": str(render_js).lower(),
        }

        try:
            response = await self._client.get(self.base_url, params=params)
            response.raise_for_status()
            content = response.text
            logger.info(f"🛡️ Scrape.do bypassed WAF for {url} ({len(content)} chars)")
            return content

        except httpx.HTTPStatusError as e:
            logger.error(f"🛡️ Scrape.do HTTP error for {url}: {e.response.status_code}")
            raise
        except Exception as e:
            logger.error(f"🛡️ Scrape.do error for {url}: {e}")
            raise

    async def scrape_with_proxy_country(
        self, url: str, country: str = "us"
    ) -> str:
        """
        Scrape using a proxy from a specific country.

        Args:
            url: Target URL.
            country: Two-letter country code for proxy selection.

        Returns:
            Raw HTML content.
        """
        params = {
            "token": self.api_token,
            "url": url,
            "geoCode": country,
        }

        try:
            response = await self._client.get(self.base_url, params=params)
            response.raise_for_status()
            return response.text
        except Exception as e:
            logger.error(f"🛡️ Scrape.do geo-proxy error for {url}: {e}")
            raise

    async def close(self) -> None:
        """Close the HTTP client."""
        await self._client.aclose()
