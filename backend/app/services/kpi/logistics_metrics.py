"""Pure order/logistics KPI formulas. No I/O -- callers supply already-
aggregated counts/timestamps pulled via repository.py.
"""
from datetime import datetime


def return_rate(returned_orders: int, total_orders: int) -> float:
    """Rate of Return = Returned Orders / Total Orders, as a percentage."""
    if total_orders == 0:
        return 0.0
    return (returned_orders / total_orders) * 100.0


def fill_rate(orders_fulfilled: int, orders_received: int) -> float:
    """Fill Rate = Orders Fulfilled / Orders Received, as a percentage."""
    if orders_received == 0:
        return 0.0
    return (orders_fulfilled / orders_received) * 100.0


def perfect_order_rate(on_time: bool, complete: bool, damage_free: bool, accurate: bool) -> float:
    """Perfect Order Rate contribution for a single order: On Time x Complete
    x Damage Free x Accurate. Averaging this across orders (done in
    repository.py's aggregate query) yields the overall rate."""
    return 100.0 if (on_time and complete and damage_free and accurate) else 0.0


def order_cycle_time(order_created_at: datetime, delivered_at: datetime) -> float:
    """Order Cycle Time = Delivered Date - Order Date, in hours."""
    return (delivered_at - order_created_at).total_seconds() / 3600.0


def picking_accuracy(correct_picks: int, total_picks: int) -> float:
    """Picking Accuracy = Correct Picks / Total Picks, as a percentage."""
    if total_picks == 0:
        return 0.0
    return (correct_picks / total_picks) * 100.0


def backorder_rate(backorders: int, total_orders: int) -> float:
    """Backorder Rate = Backorders / Total Orders, as a percentage."""
    if total_orders == 0:
        return 0.0
    return (backorders / total_orders) * 100.0


def on_time_shipping(on_time_deliveries: int, total_deliveries: int) -> float:
    """On-Time Shipping = On-Time Deliveries / Total Deliveries, as a percentage."""
    if total_deliveries == 0:
        return 0.0
    return (on_time_deliveries / total_deliveries) * 100.0
