"""
Neo4j AuraDB Driver
=====================
Connection manager for the relational topology memory tier.
Maps supply chain dependencies: Supplier → Port → Commodity → Factory.
"""

from __future__ import annotations

import logging
from typing import Any

from neo4j import AsyncGraphDatabase, AsyncDriver

from backend.config import settings

logger = logging.getLogger("scri.db.neo4j")


class Neo4jDriver:
    """Neo4j AuraDB async driver manager."""

    def __init__(self) -> None:
        self._driver: AsyncDriver | None = None

    async def connect(self) -> None:
        """Initialize the Neo4j driver."""
        try:
            self._driver = AsyncGraphDatabase.driver(
                settings.neo4j.uri,
                auth=(settings.neo4j.user, settings.neo4j.password),
            )
            # Verify connectivity
            async with self._driver.session() as session:
                result = await session.run("RETURN 1 AS ping")
                await result.single()
            logger.info(f"🔗 Neo4j connected: {settings.neo4j.uri}")
        except Exception as e:
            logger.error(f"🔗 Neo4j connection failed: {e}")
            raise

    async def disconnect(self) -> None:
        """Close the Neo4j driver."""
        if self._driver:
            await self._driver.close()
            logger.info("🔗 Neo4j disconnected")

    @property
    def driver(self) -> AsyncDriver:
        """Get the Neo4j driver, raising if not connected."""
        if self._driver is None:
            raise RuntimeError("Neo4j driver not initialized. Call connect() first.")
        return self._driver

    async def run_query(self, cypher: str, params: dict[str, Any] | None = None) -> list[dict]:
        """Execute a Cypher query and return results."""
        async with self.driver.session() as session:
            result = await session.run(cypher, **(params or {}))
            return [dict(record) async for record in result]
