"""PostgreSQL/PostGIS connection helper for the gateway's REST endpoints."""
import psycopg

from app.core.config import get_settings


async def get_postgres_connection() -> psycopg.AsyncConnection:
    settings = get_settings()
    return await psycopg.AsyncConnection.connect(
        host=settings.postgres_host,
        port=settings.postgres_port,
        dbname=settings.postgres_db,
        user=settings.postgres_user,
        password=settings.postgres_password,
    )
