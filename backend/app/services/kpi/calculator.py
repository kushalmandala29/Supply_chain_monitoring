"""Orchestrates KPI recomputation: pulls aggregates via repository.py,
applies the pure formulas in inventory_metrics.py/logistics_metrics.py,
persists + classifies the result, and returns the fact dict for the caller
(kpi_router.py) to publish over Redis. This is the one module that knows
which formula applies to which kpi_name.
"""
from datetime import datetime
from typing import Any

from app.services.kpi import inventory_metrics, logistics_metrics, repository, threshold_engine

_ORDER_BASED_KPIS = {
    "fill_rate", "return_rate", "backorder_rate", "on_time_shipping",
    "picking_accuracy", "perfect_order_rate", "order_cycle_time",
}


async def recompute_order_kpi(
    entity_type: str, entity_id: str, kpi_name: str, period_start: datetime, period_end: datetime
) -> dict[str, Any]:
    """Handles every KPI derived from order_events aggregates."""
    if kpi_name not in _ORDER_BASED_KPIS:
        raise ValueError(f"{kpi_name!r} is not an order_events-derived KPI")

    aggregates = await repository.fetch_order_aggregates(entity_type, entity_id, period_start, period_end)

    if kpi_name == "fill_rate":
        value = logistics_metrics.fill_rate(aggregates["shipped"], aggregates["total"])
    elif kpi_name == "return_rate":
        value = logistics_metrics.return_rate(aggregates["returned"], aggregates["total"])
    elif kpi_name == "backorder_rate":
        value = logistics_metrics.backorder_rate(aggregates["backordered"], aggregates["total"])
    elif kpi_name == "on_time_shipping":
        value = logistics_metrics.on_time_shipping(aggregates["on_time"], aggregates["delivered"])
    elif kpi_name == "picking_accuracy":
        value = logistics_metrics.picking_accuracy(aggregates["correct_picks"], aggregates["total_picks"])
    elif kpi_name == "perfect_order_rate":
        value = (
            (aggregates["perfect_orders"] / aggregates["delivered"]) * 100.0
            if aggregates["delivered"] else 0.0
        )
    else:  # order_cycle_time
        value = aggregates["avg_cycle_hours"]

    return await _persist(entity_type, entity_id, kpi_name, value, period_start, period_end, aggregates)


async def recompute_inventory_turnover(
    entity_type: str, entity_id: str, cogs: float, period_start: datetime, period_end: datetime
) -> dict[str, Any]:
    average_inventory = await repository.fetch_average_inventory_value(entity_id, period_start, period_end)
    value = inventory_metrics.turnover(cogs, average_inventory)
    metadata = {"cogs": cogs, "average_inventory": average_inventory}
    return await _persist(entity_type, entity_id, "inventory_turnover", value, period_start, period_end, metadata)


async def recompute_days_on_hand(
    entity_type: str, entity_id: str, daily_cogs: float, period_start: datetime, period_end: datetime
) -> dict[str, Any]:
    average_inventory = await repository.fetch_average_inventory_value(entity_id, period_start, period_end)
    value = inventory_metrics.days_on_hand(average_inventory, daily_cogs)
    metadata = {"daily_cogs": daily_cogs, "average_inventory": average_inventory}
    return await _persist(entity_type, entity_id, "days_on_hand", value, period_start, period_end, metadata)


async def recompute_inventory_accuracy(
    entity_type: str,
    entity_id: str,
    system_quantity: float,
    physical_quantity: float,
    period_start: datetime,
    period_end: datetime,
) -> dict[str, Any]:
    value = inventory_metrics.inventory_accuracy(system_quantity, physical_quantity)
    metadata = {"system_quantity": system_quantity, "physical_quantity": physical_quantity}
    return await _persist(entity_type, entity_id, "inventory_accuracy", value, period_start, period_end, metadata)


async def _persist(
    entity_type: str,
    entity_id: str,
    kpi_name: str,
    value: float,
    period_start: datetime,
    period_end: datetime,
    metadata: dict[str, Any],
) -> dict[str, Any]:
    fact = await repository.save_kpi_fact(entity_type, entity_id, kpi_name, value, period_start, period_end, metadata)
    fact["severity"] = threshold_engine.classify(kpi_name, value)
    fact["alert"] = threshold_engine.should_alert(kpi_name, value)
    return fact
