"""
Shadow Database Manager
=========================
Isolated What-If sandbox using the `shadow_whatif` schema in PostgreSQL.
All synthetic simulation runs write to this schema, keeping production data clean.
"""

from __future__ import annotations

import logging
from typing import Any

import asyncpg

from backend.config import settings

logger = logging.getLogger("scri.db.shadow")


class ShadowDBManager:
    """Manages the isolated shadow database for What-If simulations."""

    def __init__(self) -> None:
        self.schema = settings.postgres.shadow_schema
        self._pool: asyncpg.Pool | None = None

    async def connect(self) -> None:
        """Initialize connection pool with shadow schema search path."""
        try:
            self._pool = await asyncpg.create_pool(
                host=settings.postgres.host,
                port=settings.postgres.port,
                database=settings.postgres.database,
                user=settings.postgres.user,
                password=settings.postgres.password,
                min_size=1,
                max_size=3,
                server_settings={"search_path": f"{self.schema},public"},
            )
            logger.info(f"🔮 Shadow DB connected (schema: {self.schema})")
        except Exception as e:
            logger.error(f"🔮 Shadow DB connection failed: {e}")
            raise

    async def write_simulation(
        self,
        scenario_label: str,
        parameters: dict[str, Any],
        impacts: dict[str, Any],
    ) -> str:
        """
        Write a simulation result to the shadow database.

        Returns:
            The generated simulation_id UUID.
        """
        if self._pool is None:
            await self.connect()

        try:
            async with self._pool.acquire() as conn:
                row = await conn.fetchrow(
                    f"INSERT INTO {self.schema}.simulated_events "
                    f"(scenario_label, injected_parameters, computed_impacts) "
                    f"VALUES ($1, $2::jsonb, $3::jsonb) "
                    f"RETURNING simulation_id",
                    scenario_label,
                    str(parameters),
                    str(impacts),
                )
                sim_id = str(row["simulation_id"])
                logger.info(f"🔮 Simulation saved: {sim_id}")
                return sim_id

        except Exception as e:
            logger.error(f"🔮 Shadow DB write error: {e}")
            raise

    async def get_simulations(self, limit: int = 20) -> list[dict[str, Any]]:
        """Retrieve recent simulations from the shadow database."""
        if self._pool is None:
            await self.connect()

        try:
            async with self._pool.acquire() as conn:
                rows = await conn.fetch(
                    f"SELECT * FROM {self.schema}.simulated_events "
                    f"ORDER BY created_at DESC LIMIT $1",
                    limit,
                )
                return [dict(row) for row in rows]
        except Exception as e:
            logger.error(f"🔮 Shadow DB read error: {e}")
            return []

    async def disconnect(self) -> None:
        """Close the shadow database pool."""
        if self._pool:
            await self._pool.close()
            logger.info("🔮 Shadow DB disconnected")
