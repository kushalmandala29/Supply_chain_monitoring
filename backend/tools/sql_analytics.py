"""
SQL Analytics MCP Client
=========================
PostgreSQL interface for the Finance and Synthesis agents.
Executes analytical queries against the PostGIS-enabled RDS instance.
"""

from __future__ import annotations

import logging
from typing import Any

import asyncpg

from backend.config import settings

logger = logging.getLogger("scri.tools.sql_analytics")


class SQLAnalyticsClient:
    """Client for SQL analytics queries against PostgreSQL/PostGIS."""

    def __init__(self) -> None:
        self._pool: asyncpg.Pool | None = None

    async def _ensure_pool(self) -> asyncpg.Pool:
        """Ensure the connection pool is initialized."""
        if self._pool is None:
            self._pool = await asyncpg.create_pool(
                host=settings.postgres.host,
                port=settings.postgres.port,
                database=settings.postgres.database,
                user=settings.postgres.user,
                password=settings.postgres.password,
                min_size=1,
                max_size=5,
            )
        return self._pool

    async def query(self, sql: str, params: list[Any] | None = None) -> list[dict[str, Any]]:
        """
        Execute a read query and return results as a list of dictionaries.

        Args:
            sql: SQL query string with $1, $2, ... placeholders.
            params: Query parameters.

        Returns:
            List of row dictionaries.
        """
        pool = await self._ensure_pool()

        try:
            async with pool.acquire() as conn:
                rows = await conn.fetch(sql, *(params or []))
                result = [dict(row) for row in rows]
                logger.info(f"📊 SQL query returned {len(result)} rows")
                return result

        except Exception as e:
            logger.error(f"📊 SQL query error: {e}")
            raise

    async def execute(self, sql: str, params: list[Any] | None = None) -> str:
        """
        Execute a write query (INSERT, UPDATE, DELETE).

        Args:
            sql: SQL statement with $1, $2, ... placeholders.
            params: Statement parameters.

        Returns:
            Status string from the database.
        """
        pool = await self._ensure_pool()

        try:
            async with pool.acquire() as conn:
                status = await conn.execute(sql, *(params or []))
                logger.info(f"📊 SQL execute: {status}")
                return status

        except Exception as e:
            logger.error(f"📊 SQL execute error: {e}")
            raise

    async def fetch_commodity_zscore(
        self, commodity_code: str, lookback_hours: int = 168
    ) -> dict[str, Any]:
        """
        Calculate the Z-score for a commodity's latest price against recent history.

        Args:
            commodity_code: Commodity identifier.
            lookback_hours: Hours of history for the rolling window.

        Returns:
            Dictionary with mean, stddev, latest price, and Z-score.
        """
        sql = """
            WITH stats AS (
                SELECT 
                    AVG(spot_price) as mean_price,
                    STDDEV(spot_price) as stddev_price
                FROM commodity_price_ticks
                WHERE commodity_code = $1
                    AND recorded_at > NOW() - MAKE_INTERVAL(hours => $2)
            ),
            latest AS (
                SELECT spot_price
                FROM commodity_price_ticks
                WHERE commodity_code = $1
                ORDER BY recorded_at DESC
                LIMIT 1
            )
            SELECT 
                s.mean_price,
                s.stddev_price,
                l.spot_price as latest_price,
                CASE WHEN s.stddev_price > 0 
                    THEN (l.spot_price - s.mean_price) / s.stddev_price 
                    ELSE 0 
                END as zscore
            FROM stats s, latest l
        """
        results = await self.query(sql, [commodity_code, lookback_hours])
        return results[0] if results else {}

    async def close(self) -> None:
        """Close the connection pool."""
        if self._pool:
            await self._pool.close()
