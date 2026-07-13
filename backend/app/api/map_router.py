"""Map network endpoint: serves the supply-chain graph (Neo4j) and geo layers
(PostGIS shipping lanes + risk geofences) as one JSON payload for the
frontend to render on the world map. Nothing here is hardcoded -- it's a
straight read of whatever rows exist in the Knowledge Layer (seeded for
local dev via databases/neo4j/seed.cypher + databases/postgis/seed.sql, or
populated by the ETL pipelines / agents in a real deployment).
"""
import json

from fastapi import APIRouter

from app.core.neo4j_client import get_neo4j_driver
from app.core.postgres_client import get_postgres_connection

router = APIRouter(prefix="/map", tags=["map"])

_NODE_QUERY = """
MATCH (n)
WHERE n:Supplier OR n:Factory OR n:Warehouse OR n:Port
RETURN n.id AS id, n.name AS name, labels(n)[0] AS type, n.lat AS lat, n.lon AS lon, n.country AS country
"""


@router.get("/network")
async def get_network() -> dict:
    nodes = await _fetch_nodes()
    routes, geofences = await _fetch_geo_layers()
    return {"nodes": nodes, "routes": routes, "geofences": geofences}


async def _fetch_nodes() -> list[dict]:
    driver = get_neo4j_driver()
    async with driver.session() as session:
        result = await session.run(_NODE_QUERY)
        records = await result.data()
    return [
        {
            "id": r["id"],
            "name": r["name"],
            "type": r["type"],
            "lat": r["lat"],
            "lon": r["lon"],
            "country": r["country"],
        }
        for r in records
        if r["lat"] is not None and r["lon"] is not None
    ]


async def _fetch_geo_layers() -> tuple[list[dict], list[dict]]:
    conn = await get_postgres_connection()
    try:
        async with conn.cursor() as cur:
            await cur.execute(
                "SELECT id, origin_ref, destination_ref, status, ST_AsGeoJSON(geom) FROM shipping_lanes"
            )
            routes = [
                {
                    "id": row[0],
                    "origin_ref": row[1],
                    "destination_ref": row[2],
                    "status": row[3],
                    "geometry": json.loads(row[4]),
                }
                for row in await cur.fetchall()
            ]

            await cur.execute("SELECT id, label, risk_level, ST_AsGeoJSON(geom) FROM geofences")
            geofences = [
                {
                    "id": row[0],
                    "label": row[1],
                    "risk_level": row[2],
                    "geometry": json.loads(row[3]),
                }
                for row in await cur.fetchall()
            ]
    finally:
        await conn.close()
    return routes, geofences
