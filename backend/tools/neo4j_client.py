"""
Neo4j Graph MCP Client
========================
Topology traversal tool for the Logistics Agent.
Queries the Neo4j AuraDB supply chain dependency graph for
port-to-commodity links, multihop routing paths, and structural dependency trees.
"""

from __future__ import annotations

import logging
from typing import Any

from neo4j import AsyncGraphDatabase, AsyncDriver

from backend.config import settings

logger = logging.getLogger("scri.tools.neo4j")


class Neo4jGraphClient:
    """Client for Neo4j graph topology queries."""

    def __init__(self) -> None:
        self._driver: AsyncDriver | None = None

    async def _ensure_driver(self) -> AsyncDriver:
        """Ensure the Neo4j driver is initialized."""
        if self._driver is None:
            self._driver = AsyncGraphDatabase.driver(
                settings.neo4j.uri,
                auth=(settings.neo4j.user, settings.neo4j.password),
            )
        return self._driver

    async def find_affected_links(self, node_name: str) -> list[dict[str, Any]]:
        """
        Find all trade links affected by a disruption at a specific node.

        Args:
            node_name: Name of the disrupted node (port, strait, hub).

        Returns:
            List of affected trade link dictionaries.
        """
        driver = await self._ensure_driver()
        query = """
            MATCH (n {name: $node_name})-[r:CONNECTS_TO|SUPPLIES|ROUTES_THROUGH*1..3]-(m)
            RETURN n.name AS source, 
                   type(r[0]) AS relationship,
                   m.name AS target, 
                   m.type AS target_type,
                   m.capacity AS capacity
            LIMIT 50
        """

        try:
            async with driver.session() as session:
                result = await session.run(query, node_name=node_name)
                records = [dict(record) async for record in result]
                logger.info(f"🔗 Neo4j found {len(records)} affected links for '{node_name}'")
                return records

        except Exception as e:
            logger.error(f"🔗 Neo4j query error: {e}")
            raise

    async def find_alternate_routes(
        self, source: str, destination: str, blocked_nodes: list[str] | None = None
    ) -> list[dict[str, Any]]:
        """
        Find alternate shipping routes avoiding blocked nodes.

        Args:
            source: Starting port/node.
            destination: Target port/node.
            blocked_nodes: List of nodes to avoid.

        Returns:
            List of alternate route options.
        """
        driver = await self._ensure_driver()
        blocked = blocked_nodes or []

        query = """
            MATCH path = shortestPath(
                (s {name: $source})-[*..10]-(d {name: $destination})
            )
            WHERE NONE(n IN nodes(path) WHERE n.name IN $blocked)
            RETURN [n IN nodes(path) | n.name] AS route_nodes,
                   length(path) AS hops,
                   reduce(t = 0, r IN relationships(path) | t + coalesce(r.transit_days, 1)) AS total_days
            ORDER BY total_days ASC
            LIMIT 5
        """

        try:
            async with driver.session() as session:
                result = await session.run(
                    query,
                    source=source,
                    destination=destination,
                    blocked=blocked,
                )
                records = [dict(record) async for record in result]
                logger.info(f"🔗 Neo4j found {len(records)} alternate routes")
                return records

        except Exception as e:
            logger.error(f"🔗 Neo4j alternate route query error: {e}")
            raise

    async def get_commodity_dependencies(self, port_name: str) -> list[dict[str, Any]]:
        """
        Get all commodities that depend on a specific port.

        Args:
            port_name: Name of the port.

        Returns:
            List of commodity dependency records.
        """
        driver = await self._ensure_driver()
        query = """
            MATCH (p:Port {name: $port_name})-[:HANDLES]->(c:Commodity)-[:CONSUMED_BY]->(f:Factory)
            RETURN c.name AS commodity, 
                   c.code AS commodity_code,
                   f.name AS factory, 
                   f.country AS country,
                   c.annual_volume_tons AS annual_volume
            ORDER BY c.annual_volume_tons DESC
        """

        try:
            async with driver.session() as session:
                result = await session.run(query, port_name=port_name)
                records = [dict(record) async for record in result]
                logger.info(f"🔗 Found {len(records)} commodity dependencies for '{port_name}'")
                return records

        except Exception as e:
            logger.error(f"🔗 Neo4j commodity query error: {e}")
            raise

    async def close(self) -> None:
        """Close the Neo4j driver."""
        if self._driver:
            await self._driver.close()
