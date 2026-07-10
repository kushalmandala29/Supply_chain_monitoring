"""
Commodity Price ETL Processor
===============================
Hourly extraction of commodity price data with Z-score anomaly detection.
Triggers commodity_shock events when Z-score >= 2.5 threshold is breached.
"""

from __future__ import annotations

import logging
from typing import Any

from backend.config import settings
from backend.tools.sql_analytics import SQLAnalyticsClient

logger = logging.getLogger("scri.ingestion.commodity_etl")

# Tracked commodity codes
TRACKED_COMMODITIES = [
    "CRUDE_OIL_WTI",
    "CRUDE_OIL_BRENT",
    "NATURAL_GAS",
    "COPPER",
    "IRON_ORE",
    "WHEAT",
    "CORN",
    "SOYBEANS",
    "ALUMINUM",
    "LITHIUM",
    "CONTAINER_FREIGHT_INDEX",
]


class CommodityETLProcessor:
    """Processes commodity price data and detects statistical anomalies."""

    def __init__(self) -> None:
        self.sql_client = SQLAnalyticsClient()
        self.zscore_threshold = settings.app.zscore_threshold

    async def run_etl_cycle(self, price_data: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """
        Run a full ETL cycle: ingest prices, compute Z-scores, detect anomalies.

        Args:
            price_data: List of {commodity_code, spot_price, source_feed} dictionaries.

        Returns:
            List of anomaly events (only items exceeding Z-score threshold).
        """
        anomalies = []

        # Batch insert price ticks
        for tick in price_data:
            await self._insert_price_tick(tick)

        # Compute Z-scores for all tracked commodities
        for code in TRACKED_COMMODITIES:
            try:
                stats = await self.sql_client.fetch_commodity_zscore(code)
                if stats and abs(stats.get("zscore", 0)) >= self.zscore_threshold:
                    anomaly = {
                        "commodity_code": code,
                        "zscore": float(stats["zscore"]),
                        "latest_price": float(stats["latest_price"]),
                        "mean_price": float(stats["mean_price"]),
                        "trigger_source": "commodity_shock",
                    }
                    anomalies.append(anomaly)
                    logger.warning(
                        f"📊 ANOMALY: {code} Z-score={stats['zscore']:.2f} "
                        f"(threshold={self.zscore_threshold})"
                    )
            except Exception as e:
                logger.warning(f"📊 Z-score computation failed for {code}: {e}")

        logger.info(f"📊 ETL cycle complete: {len(price_data)} ticks, {len(anomalies)} anomalies")
        return anomalies

    async def _insert_price_tick(self, tick: dict[str, Any]) -> None:
        """Insert a single price tick into the database."""
        try:
            await self.sql_client.execute(
                "INSERT INTO commodity_price_ticks (commodity_code, spot_price, source_feed) "
                "VALUES ($1, $2, $3)",
                [tick["commodity_code"], tick["spot_price"], tick.get("source_feed", "etl")],
            )
        except Exception as e:
            logger.error(f"📊 Price tick insert error: {e}")
