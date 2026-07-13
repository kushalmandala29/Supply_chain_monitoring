"""KPI webhooks + read endpoints. Modeled directly on map_router.py's shape
(APIRouter, raw psycopg/neo4j queries, plain dict responses) -- this is the
only place order/inventory events enter the platform (no ERP/WMS/OMS
ingestion, no scheduler; every recompute happens inline in the request that
reported the event).
"""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException

from app.core.neo4j_client import get_neo4j_driver
from app.core.redis_streams import StreamBus
from app.models.kpi import (
    InventoryUpdatePayload,
    OrderDamagedPayload,
    OrderDeliveredPayload,
    OrderReturnedPayload,
    OrderShippedPayload,
)
from app.services.kpi import calculator, repository, websocket_publisher
from app.services.kpi.inventory_metrics import inventory_accuracy as _inventory_accuracy

router = APIRouter(tags=["kpi"])

_ORDER_WINDOW = timedelta(days=1)
_INVENTORY_WINDOW = timedelta(days=7)


def _order_period() -> tuple[datetime, datetime]:
    now = datetime.now(timezone.utc)
    return now - _ORDER_WINDOW, now


def _inventory_period() -> tuple[datetime, datetime]:
    now = datetime.now(timezone.utc)
    return now - _INVENTORY_WINDOW, now


async def _publish(bus: StreamBus, fact: dict) -> None:
    await websocket_publisher.publish_kpi_update(bus, fact)
    await websocket_publisher.publish_kpi_alert(bus, fact)


@router.post("/webhooks/orders/shipped")
async def order_shipped(payload: OrderShippedPayload) -> dict:
    fields = {
        "order_created_at": payload.order_created_at,
        "shipped_at": payload.shipped_at,
    }
    if payload.supplier_id is not None:
        fields["supplier_id"] = payload.supplier_id
    if payload.warehouse_id is not None:
        fields["warehouse_id"] = payload.warehouse_id
    if payload.route_id is not None:
        fields["route_id"] = payload.route_id
    await repository.upsert_order_event(payload.order_id, fields)
    await repository.refresh_materialized_views()

    bus = StreamBus()
    try:
        facts = []
        if payload.warehouse_id is not None:
            period_start, period_end = _order_period()
            fact = await calculator.recompute_order_kpi(
                "warehouse", payload.warehouse_id, "fill_rate", period_start, period_end
            )
            await _publish(bus, fact)
            facts.append(fact)
    finally:
        await bus.close()

    return {"status": "ok", "order_id": payload.order_id, "kpi_facts": facts}


@router.post("/webhooks/orders/delivered")
async def order_delivered(payload: OrderDeliveredPayload) -> dict:
    await repository.upsert_order_event(
        payload.order_id,
        {
            "delivered_at": payload.delivered_at,
            "on_time_flag": payload.on_time_flag,
            "picked_correctly": payload.picked_correctly,
            "damaged_flag": payload.damaged_flag,
        },
    )
    await repository.refresh_materialized_views()

    order = await repository.fetch_order_event(payload.order_id)
    if order is None:
        raise HTTPException(status_code=404, detail=f"Unknown order_id: {payload.order_id!r}")

    period_start, period_end = _order_period()
    bus = StreamBus()
    facts = []
    try:
        if order["route_id"] is not None:
            for kpi_name in ("perfect_order_rate", "order_cycle_time", "on_time_shipping"):
                fact = await calculator.recompute_order_kpi(
                    "route", order["route_id"], kpi_name, period_start, period_end
                )
                await _publish(bus, fact)
                facts.append(fact)
        if order["warehouse_id"] is not None:
            fact = await calculator.recompute_order_kpi(
                "warehouse", order["warehouse_id"], "picking_accuracy", period_start, period_end
            )
            await _publish(bus, fact)
            facts.append(fact)
    finally:
        await bus.close()

    return {"status": "ok", "order_id": payload.order_id, "kpi_facts": facts}


@router.post("/webhooks/orders/returned")
async def order_returned(payload: OrderReturnedPayload) -> dict:
    await repository.upsert_order_event(payload.order_id, {"returned_at": payload.returned_at})

    order = await repository.fetch_order_event(payload.order_id)
    if order is None:
        raise HTTPException(status_code=404, detail=f"Unknown order_id: {payload.order_id!r}")

    period_start, period_end = _order_period()
    bus = StreamBus()
    facts = []
    try:
        for entity_type, entity_id in (
            ("supplier", order["supplier_id"]),
            ("warehouse", order["warehouse_id"]),
        ):
            if entity_id is not None:
                fact = await calculator.recompute_order_kpi(
                    entity_type, entity_id, "return_rate", period_start, period_end
                )
                await _publish(bus, fact)
                facts.append(fact)
    finally:
        await bus.close()

    return {"status": "ok", "order_id": payload.order_id, "kpi_facts": facts}


@router.post("/webhooks/orders/damaged")
async def order_damaged(payload: OrderDamagedPayload) -> dict:
    await repository.upsert_order_event(payload.order_id, {"damaged_flag": payload.damaged_flag})

    order = await repository.fetch_order_event(payload.order_id)
    if order is None:
        raise HTTPException(status_code=404, detail=f"Unknown order_id: {payload.order_id!r}")

    facts = []
    if order["route_id"] is not None and order["delivered_at"] is not None:
        period_start, period_end = _order_period()
        bus = StreamBus()
        try:
            fact = await calculator.recompute_order_kpi(
                "route", order["route_id"], "perfect_order_rate", period_start, period_end
            )
            await _publish(bus, fact)
            facts.append(fact)
        finally:
            await bus.close()

    return {"status": "ok", "order_id": payload.order_id, "kpi_facts": facts}


@router.post("/webhooks/inventory/update")
async def inventory_update(payload: InventoryUpdatePayload) -> dict:
    accuracy = None
    if payload.system_quantity is not None and payload.physical_quantity is not None:
        accuracy = _inventory_accuracy(payload.system_quantity, payload.physical_quantity)

    await repository.insert_inventory_snapshot(
        payload.warehouse_id,
        payload.sku_id,
        payload.inventory_count,
        payload.inventory_value,
        accuracy,
    )

    period_start, period_end = _inventory_period()
    bus = StreamBus()
    facts = []
    try:
        if payload.system_quantity is not None and payload.physical_quantity is not None:
            fact = await calculator.recompute_inventory_accuracy(
                "warehouse", payload.warehouse_id, payload.system_quantity,
                payload.physical_quantity, period_start, period_end,
            )
            await _publish(bus, fact)
            facts.append(fact)
        if payload.cogs is not None:
            fact = await calculator.recompute_inventory_turnover(
                "warehouse", payload.warehouse_id, payload.cogs, period_start, period_end
            )
            await _publish(bus, fact)
            facts.append(fact)
        if payload.daily_cogs is not None:
            fact = await calculator.recompute_days_on_hand(
                "warehouse", payload.warehouse_id, payload.daily_cogs, period_start, period_end
            )
            await _publish(bus, fact)
            facts.append(fact)
    finally:
        await bus.close()

    return {"status": "ok", "warehouse_id": payload.warehouse_id, "kpi_facts": facts}


@router.get("/kpi/network")
async def kpi_network() -> dict:
    """Latest KPI snapshot for every entity, joined with Neo4j coordinates --
    what the globe/HUD KPI rings load on mount (parity with GET /map/network)."""
    snapshot = await repository.fetch_kpi_network_snapshot()
    node_ids = {row["entity_id"] for row in snapshot if row["entity_type"] != "route"}
    route_ids = {row["entity_id"] for row in snapshot if row["entity_type"] == "route"}

    coords_by_id = await _fetch_node_coords(node_ids) if node_ids else {}
    route_coords = await _fetch_route_coords(route_ids) if route_ids else {}

    entities: dict[str, dict] = {}
    for row in snapshot:
        entity_id = row["entity_id"]
        if entity_id not in entities:
            location = (
                route_coords.get(entity_id)
                if row["entity_type"] == "route"
                else coords_by_id.get(entity_id)
            )
            entities[entity_id] = {
                "entity_id": entity_id,
                "entity_type": row["entity_type"],
                "location": location,
                "kpis": {},
            }
        entities[entity_id]["kpis"][row["kpi_name"]] = {
            "value": row["kpi_value"],
            "computed_at": row["computed_at"],
        }

    return {"entities": list(entities.values())}


@router.get("/kpi/history")
async def kpi_history(entity_id: str, kpi_name: str, limit: int = 30) -> dict:
    history = await repository.fetch_kpi_history(entity_id, kpi_name, limit)
    return {"entity_id": entity_id, "kpi_name": kpi_name, "history": history}


@router.get("/kpi/dashboard")
async def kpi_dashboard() -> dict:
    return await repository.fetch_kpi_dashboard_totals()


async def _fetch_node_coords(entity_ids: set[str]) -> dict[str, dict]:
    driver = get_neo4j_driver()
    async with driver.session() as session:
        result = await session.run(
            "MATCH (n) WHERE n.id IN $ids RETURN n.id AS id, n.lat AS lat, n.lon AS lon, n.name AS name",
            ids=list(entity_ids),
        )
        records = await result.data()
    return {
        r["id"]: {"lat": r["lat"], "lon": r["lon"], "name": r["name"]}
        for r in records
        if r["lat"] is not None and r["lon"] is not None
    }


async def _fetch_route_coords(route_ids: set[str]) -> dict[str, dict]:
    driver = get_neo4j_driver()
    async with driver.session() as session:
        result = await session.run(
            """
            MATCH (a:Port)-[r:CONNECTS_TO]->(b:Port)
            WHERE r.route_id IN $ids
            RETURN r.route_id AS route_id, a.lat AS origin_lat, a.lon AS origin_lon,
                   b.lat AS dest_lat, b.lon AS dest_lon
            """,
            ids=list(route_ids),
        )
        records = await result.data()
    return {
        r["route_id"]: {
            "origin": {"lat": r["origin_lat"], "lon": r["origin_lon"]},
            "destination": {"lat": r["dest_lat"], "lon": r["dest_lon"]},
        }
        for r in records
    }
