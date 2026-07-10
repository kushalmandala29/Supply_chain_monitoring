"""
PostgreSQL / PostGIS Connection Pool
======================================
Async connection pool for the persistent analytics memory tier.
Manages connections to the production and shadow (What-If) databases.
"""

from __future__ import annotations

import logging

import asyncpg

from backend.config import settings

logger = logging.getLogger("scri.db.postgres")


class PostgresPool:
    """Async PostgreSQL connection pool manager."""

    def __init__(self) -> None:
        self._pool: asyncpg.Pool | None = None

    async def connect(self) -> None:
        """Initialize the connection pool."""
        try:
            self._pool = await asyncpg.create_pool(
                host=settings.postgres.host,
                port=settings.postgres.port,
                database=settings.postgres.database,
                user=settings.postgres.user,
                password=settings.postgres.password,
                min_size=2,
                max_size=10,
            )
            logger.info(f"🐘 PostgreSQL pool connected: {settings.postgres.host}:{settings.postgres.port}")
        except Exception as e:
            logger.error(f"🐘 PostgreSQL connection failed: {e}")
            raise

    async def disconnect(self) -> None:
        """Close all connections in the pool."""
        if self._pool:
            await self._pool.close()
            logger.info("🐘 PostgreSQL pool disconnected")

    @property
    def pool(self) -> asyncpg.Pool:
        """Get the connection pool, raising if not connected."""
        if self._pool is None:
            raise RuntimeError("PostgreSQL pool not initialized. Call connect() first.")
        return self._pool

    async def fetch(self, query: str, *args) -> list[dict]:
        """Execute a query and return results as list of dicts."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query, *args)
            return [dict(row) for row in rows]

    async def fetchrow(self, query: str, *args) -> dict | None:
        """Execute a query and return a single row as dict."""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(query, *args)
            return dict(row) if row else None

    async def execute(self, query: str, *args) -> str:
        """Execute a write query (INSERT, UPDATE, DELETE)."""
        async with self.pool.acquire() as conn:
            return await conn.execute(query, *args)
