"""All Postgres reads/writes for the KPI pipeline (raw SQL via psycopg, same
convention as app/core/postgres_client.py and app/api/map_router.py -- no
ORM). Also owns the one-way write-through sync into Neo4j: every
save_kpi_fact() call MERGEs the latest value onto the corresponding graph
node/relationship immediately afterwards, so Neo4j never drifts far from
Postgres and is never itself the source of truth.
"""
import json
from datetime import datetime, timezone
from typing import Any

from psycopg.types.json import Json

from app.core.neo4j_client import get_neo4j_driver
from app.core.postgres_client import get_postgres_connection

# Whitelisted KPI names -- the only values ever interpolated into a Cypher
# SET clause (Neo4j has no way to parameterize a property *name*, only its
# value, so this whitelist is what keeps _sync_neo4j injection-safe).
VALID_KPI_NAMES = {
    "inventory_turnover",
    "inventory_accuracy",
    "days_on_hand",
    "return_rate",
    "backorder_rate",
    "fill_rate",
    "perfect_order_rate",
    "order_cycle_time",
    "picking_accuracy",
    "on_time_shipping",
}

_ORDER_EVENT_COLUMNS = {
    "supplier_id",
    "warehouse_id",
    "route_id",
    "order_created_at",
    "packed_at",
    "shipped_at",
    "delivered_at",
    "returned_at",
    "damaged_flag",
    "picked_correctly",
    "on_time_flag",
    "backordered_flag",
}


async def upsert_order_event(order_id: str, fields: dict[str, Any]) -> None:
    """Insert the order on first sight, otherwise update just the columns
    provided (e.g. the 'shipped' webhook only knows shipped_at).

    order_created_at is NOT NULL with no default, but Postgres still
    validates NOT NULL constraints on the INSERT branch of an
    `ON CONFLICT DO UPDATE` even when the row already exists and the update
    path is what actually applies -- so a partial update (delivered/
    returned/damaged, none of which know the order's creation time) would
    otherwise fail outright. We default it to now() for the INSERT-only
    path, but never let that fallback clobber a real value on conflict --
    the UPDATE SET clause only ever touches columns the caller explicitly
    provided.
    """
    unknown = set(fields) - _ORDER_EVENT_COLUMNS
    if unknown:
        raise ValueError(f"Unknown order_events column(s): {unknown}")

    insert_fields = dict(fields)
    insert_fields.setdefault("order_created_at", datetime.now(timezone.utc))

    columns = ["order_id", *insert_fields.keys()]
    values = [order_id, *insert_fields.values()]
    placeholders = ", ".join(["%s"] * len(columns))
    update_clause = ", ".join(f"{col} = EXCLUDED.{col}" for col in fields)

    conn = await get_postgres_connection()
    try:
        async with conn.cursor() as cur:
            await cur.execute(
                f"""
                INSERT INTO order_events ({", ".join(columns)})
                VALUES ({placeholders})
                ON CONFLICT (order_id) DO UPDATE SET {update_clause or "order_id = EXCLUDED.order_id"}
                """,
                values,
            )
        await conn.commit()
    finally:
        await conn.close()


async def fetch_order_event(order_id: str) -> dict[str, Any] | None:
    conn = await get_postgres_connection()
    try:
        async with conn.cursor() as cur:
            await cur.execute(
                "SELECT order_id, supplier_id, warehouse_id, route_id, order_created_at, "
                "packed_at, shipped_at, delivered_at, returned_at, damaged_flag, "
                "picked_correctly, on_time_flag, backordered_flag "
                "FROM order_events WHERE order_id = %s",
                (order_id,),
            )
            row = await cur.fetchone()
    finally:
        await conn.close()
    if row is None:
        return None
    columns = [
        "order_id", "supplier_id", "warehouse_id", "route_id", "order_created_at",
        "packed_at", "shipped_at", "delivered_at", "returned_at", "damaged_flag",
        "picked_correctly", "on_time_flag", "backordered_flag",
    ]
    return dict(zip(columns, row))


async def insert_inventory_snapshot(
    warehouse_id: str,
    sku_id: str,
    inventory_count: int,
    inventory_value: float,
    inventory_accuracy: float | None,
) -> None:
    conn = await get_postgres_connection()
    try:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                INSERT INTO inventory_snapshots
                    (warehouse_id, sku_id, inventory_count, inventory_value, inventory_accuracy)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (warehouse_id, sku_id, inventory_count, inventory_value, inventory_accuracy),
            )
        await conn.commit()
    finally:
        await conn.close()


async def fetch_average_inventory_value(
    warehouse_id: str, period_start: datetime, period_end: datetime
) -> float:
    conn = await get_postgres_connection()
    try:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                SELECT avg(inventory_value) FROM inventory_snapshots
                WHERE warehouse_id = %s AND snapshot_timestamp BETWEEN %s AND %s
                """,
                (warehouse_id, period_start, period_end),
            )
            row = await cur.fetchone()
    finally:
        await conn.close()
    return float(row[0]) if row and row[0] is not None else 0.0


async def fetch_order_aggregates(
    entity_type: str, entity_id: str, period_start: datetime, period_end: datetime
) -> dict[str, int | float]:
    """One aggregate query covering every count/average the logistics KPI
    formulas need for a given warehouse/supplier/route."""
    column = {"warehouse": "warehouse_id", "supplier": "supplier_id", "route": "route_id"}[entity_type]
    conn = await get_postgres_connection()
    try:
        async with conn.cursor() as cur:
            await cur.execute(
                f"""
                SELECT
                    count(*) AS total,
                    count(*) FILTER (WHERE shipped_at IS NOT NULL) AS shipped,
                    count(*) FILTER (WHERE returned_at IS NOT NULL) AS returned,
                    count(*) FILTER (WHERE backordered_flag) AS backordered,
                    count(*) FILTER (WHERE on_time_flag IS TRUE AND delivered_at IS NOT NULL) AS on_time,
                    count(*) FILTER (WHERE delivered_at IS NOT NULL) AS delivered,
                    count(*) FILTER (WHERE picked_correctly IS TRUE) AS correct_picks,
                    count(*) FILTER (WHERE picked_correctly IS NOT NULL) AS total_picks,
                    count(*) FILTER (
                        WHERE on_time_flag IS TRUE AND damaged_flag IS FALSE
                              AND picked_correctly IS TRUE AND delivered_at IS NOT NULL
                    ) AS perfect_orders,
                    avg(EXTRACT(EPOCH FROM (delivered_at - order_created_at)) / 3600.0)
                        FILTER (WHERE delivered_at IS NOT NULL) AS avg_cycle_hours
                FROM order_events
                WHERE {column} = %s AND order_created_at BETWEEN %s AND %s
                """,
                (entity_id, period_start, period_end),
            )
            row = await cur.fetchone()
    finally:
        await conn.close()

    columns = [
        "total", "shipped", "returned", "backordered", "on_time", "delivered",
        "correct_picks", "total_picks", "perfect_orders", "avg_cycle_hours",
    ]
    result = dict(zip(columns, row)) if row else {c: 0 for c in columns}
    result["avg_cycle_hours"] = float(result["avg_cycle_hours"] or 0.0)
    return result


async def refresh_materialized_views() -> None:
    """Request-triggered refresh -- called right after a webhook write.
    There is no scheduler (Celery Beat is explicitly out of scope)."""
    conn = await get_postgres_connection()
    try:
        async with conn.cursor() as cur:
            for view in ("mv_fill_rate", "mv_perfect_order_rate", "mv_order_cycle_time"):
                await cur.execute(f"REFRESH MATERIALIZED VIEW CONCURRENTLY {view}")
        await conn.commit()
    finally:
        await conn.close()


async def save_kpi_fact(
    entity_type: str,
    entity_id: str,
    kpi_name: str,
    kpi_value: float,
    period_start: datetime,
    period_end: datetime,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if kpi_name not in VALID_KPI_NAMES:
        raise ValueError(f"Unknown kpi_name: {kpi_name!r}")

    computed_at = datetime.now(timezone.utc)
    conn = await get_postgres_connection()
    try:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                INSERT INTO kpi_facts
                    (entity_id, entity_type, kpi_name, kpi_value, period_start, period_end,
                     computed_at, metadata)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id, created_at
                """,
                (
                    entity_id, entity_type, kpi_name, kpi_value, period_start, period_end,
                    computed_at, Json(metadata or {}),
                ),
            )
            fact_id, created_at = await cur.fetchone()
        await conn.commit()
    finally:
        await conn.close()

    await _sync_neo4j(entity_type, entity_id, kpi_name, kpi_value)

    return {
        "id": fact_id,
        "entity_id": entity_id,
        "entity_type": entity_type,
        "kpi_name": kpi_name,
        "kpi_value": kpi_value,
        "period_start": period_start.isoformat(),
        "period_end": period_end.isoformat(),
        "computed_at": computed_at.isoformat(),
        "created_at": created_at.isoformat(),
    }


async def _sync_neo4j(entity_type: str, entity_id: str, kpi_name: str, value: float) -> None:
    """Write-through summary only -- Neo4j is never read to derive this
    value, only written to after Postgres already has it."""
    if kpi_name not in VALID_KPI_NAMES:
        raise ValueError(f"Unknown kpi_name: {kpi_name!r}")

    driver = get_neo4j_driver()
    async with driver.session() as session:
        if entity_type == "route":
            # Routes are the (:Port)-[:CONNECTS_TO {route_id}]->(:Port)
            # relationship, not a node (see databases/neo4j/constraints.cypher).
            await session.run(
                f"MATCH ()-[r:CONNECTS_TO {{route_id: $entity_id}}]->() SET r.{kpi_name} = $value",
                entity_id=entity_id, value=value,
            )
        else:
            await session.run(
                f"MERGE (n {{id: $entity_id}}) SET n.{kpi_name} = $value",
                entity_id=entity_id, value=value,
            )


async def fetch_kpi_history(entity_id: str, kpi_name: str, limit: int = 30) -> list[dict[str, Any]]:
    conn = await get_postgres_connection()
    try:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                SELECT kpi_value, period_start, period_end, computed_at FROM kpi_facts
                WHERE entity_id = %s AND kpi_name = %s
                ORDER BY computed_at DESC LIMIT %s
                """,
                (entity_id, kpi_name, limit),
            )
            rows = await cur.fetchall()
    finally:
        await conn.close()
    return [
        {
            "kpi_value": float(value),
            "period_start": period_start.isoformat(),
            "period_end": period_end.isoformat(),
            "computed_at": computed_at.isoformat(),
        }
        for value, period_start, period_end, computed_at in reversed(rows)
    ]


async def fetch_kpi_network_snapshot() -> list[dict[str, Any]]:
    """Latest value of every KPI for every entity, for the frontend's
    initial-load GET /kpi/network (parity with GET /map/network)."""
    conn = await get_postgres_connection()
    try:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                SELECT DISTINCT ON (entity_id, kpi_name)
                    entity_id, entity_type, kpi_name, kpi_value, computed_at
                FROM kpi_facts
                ORDER BY entity_id, kpi_name, computed_at DESC
                """
            )
            rows = await cur.fetchall()
    finally:
        await conn.close()
    return [
        {
            "entity_id": entity_id,
            "entity_type": entity_type,
            "kpi_name": kpi_name,
            "kpi_value": float(kpi_value),
            "computed_at": computed_at.isoformat(),
        }
        for entity_id, entity_type, kpi_name, kpi_value, computed_at in rows
    ]


async def fetch_kpi_dashboard_totals() -> dict[str, float]:
    """Aggregate (average) of each KPI's latest-known value across every
    entity -- feeds the frontend's GlobalDashboard panel."""
    conn = await get_postgres_connection()
    try:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                SELECT kpi_name, avg(kpi_value) FROM (
                    SELECT DISTINCT ON (entity_id, kpi_name) entity_id, kpi_name, kpi_value
                    FROM kpi_facts
                    ORDER BY entity_id, kpi_name, computed_at DESC
                ) latest
                GROUP BY kpi_name
                """
            )
            rows = await cur.fetchall()
    finally:
        await conn.close()
    return {kpi_name: float(avg_value) for kpi_name, avg_value in rows}
