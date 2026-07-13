"""PostgreSQL connection helper for agents that need read access to KPI data
(Logistics, Commodity, Intel, Supervisor). Mirrors
backend/app/core/postgres_client.py -- agents and the gateway are separate
deployables (see docker-compose.yml) that don't import each other, so this
duplicates that one small helper rather than adding a new shared package,
following the same precedent as agents/common/config.py duplicating
backend/app/core/config.py.
"""
import psycopg

from common.config import get_agent_settings


async def get_postgres_connection() -> psycopg.AsyncConnection:
    settings = get_agent_settings()
    return await psycopg.AsyncConnection.connect(
        host=settings.postgres_host,
        port=settings.postgres_port,
        dbname=settings.postgres_db,
        user=settings.postgres_user,
        password=settings.postgres_password,
    )
