"""
RSS / GDELT Feed Processor
============================
Continuous 5-minute cron processor for news and GDELT event feeds.
Normalizes incoming items and dispatches structured events to the SQS task queue.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

import feedparser

logger = logging.getLogger("scri.ingestion.rss")

# Curated RSS feeds for supply chain and geopolitical risk monitoring
DEFAULT_RSS_FEEDS = [
    "https://news.google.com/rss/search?q=supply+chain+disruption",
    "https://news.google.com/rss/search?q=shipping+port+congestion",
    "https://news.google.com/rss/search?q=trade+sanctions",
    "https://www.reliefweb.int/updates/rss.xml",
]


class RSSProcessor:
    """Processes RSS and GDELT news feeds into structured events."""

    def __init__(self, feeds: list[str] | None = None) -> None:
        self.feeds = feeds or DEFAULT_RSS_FEEDS

    async def fetch_and_normalize(self) -> list[dict[str, Any]]:
        """
        Fetch all configured RSS feeds and normalize entries.

        Returns:
            List of normalized event dictionaries.
        """
        events = []

        for feed_url in self.feeds:
            try:
                parsed = feedparser.parse(feed_url)
                for entry in parsed.entries[:10]:  # Cap per feed
                    event = self._normalize_entry(entry, feed_url)
                    if event:
                        events.append(event)
            except Exception as e:
                logger.warning(f"📡 RSS fetch error for {feed_url}: {e}")

        logger.info(f"📡 RSS processor: {len(events)} events normalized from {len(self.feeds)} feeds")
        return events

    def _normalize_entry(self, entry: Any, source_url: str) -> dict[str, Any] | None:
        """Normalize a single RSS entry into a structured event."""
        try:
            return {
                "source_feed": source_url,
                "headline": getattr(entry, "title", ""),
                "summary": getattr(entry, "summary", ""),
                "link": getattr(entry, "link", ""),
                "published": getattr(entry, "published", ""),
                "processed_at": datetime.now(timezone.utc).isoformat(),
                "trigger_source": "live_ingestion",
            }
        except Exception as e:
            logger.warning(f"📡 Entry normalization error: {e}")
            return None
