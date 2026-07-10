"""
C++ Spatial Engine MCP Client
==============================
Winding number point-in-polygon spatial computation tool.
Used by the Spatial Agent for precise geometric intersection checks.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from backend.config import settings

logger = logging.getLogger("scri.tools.spatial_engine")


class SpatialEngineClient:
    """Client for the C++ Spatial Engine MCP server."""

    def __init__(self) -> None:
        self.base_url = "http://localhost:8083"  # Local MCP server port
        self.precision = settings.mcp.spatial_precision
        self._client = httpx.AsyncClient(timeout=15.0)

    async def check_intersection(
        self, geojson_polygon: dict[str, Any]
    ) -> dict[str, Any]:
        """
        Check if shipping routes intersect with a given GeoJSON polygon.

        Args:
            geojson_polygon: GeoJSON Polygon object with coordinates.

        Returns:
            Intersection result with affected route segments.
        """
        payload = {
            "operation": "point_in_polygon",
            "polygon": geojson_polygon,
            "precision": self.precision,
        }

        try:
            response = await self._client.post(
                f"{self.base_url}/intersect",
                json=payload,
            )
            response.raise_for_status()
            result = response.json()
            logger.info(f"📐 Spatial intersection computed — {result.get('matches', 0)} matches")
            return result

        except Exception as e:
            logger.error(f"📐 Spatial engine error: {e}")
            raise

    async def resolve_boundary(self, location_name: str) -> dict[str, Any]:
        """
        Resolve a named location into its GeoJSON boundary polygon.

        Args:
            location_name: Name of the geographic feature (e.g., 'Malacca Strait').

        Returns:
            GeoJSON polygon boundary.
        """
        payload = {
            "operation": "resolve_boundary",
            "location": location_name,
        }

        try:
            response = await self._client.post(
                f"{self.base_url}/resolve",
                json=payload,
            )
            response.raise_for_status()
            return response.json()

        except Exception as e:
            logger.error(f"📐 Boundary resolution error for {location_name}: {e}")
            raise

    async def compute_route_overlap(
        self,
        route_geojson: dict[str, Any],
        zone_geojson: dict[str, Any],
    ) -> float:
        """
        Compute the percentage overlap between a shipping route and a disruption zone.

        Returns:
            Overlap percentage (0.0 — 1.0).
        """
        payload = {
            "operation": "route_overlap",
            "route": route_geojson,
            "zone": zone_geojson,
        }

        try:
            response = await self._client.post(
                f"{self.base_url}/overlap",
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
            return data.get("overlap_percent", 0.0)

        except Exception as e:
            logger.error(f"📐 Route overlap computation error: {e}")
            raise

    async def close(self) -> None:
        """Close the HTTP client."""
        await self._client.aclose()
