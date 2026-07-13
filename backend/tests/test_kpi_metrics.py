"""Unit tests for the pure KPI formula functions -- no DB/Redis needed since
these take plain numbers/timestamps and return a float."""
from datetime import datetime, timezone

from app.services.kpi import inventory_metrics, logistics_metrics


def test_turnover():
    assert inventory_metrics.turnover(cogs=120000, average_inventory=20000) == 6.0


def test_turnover_zero_average_inventory():
    assert inventory_metrics.turnover(cogs=100, average_inventory=0) == 0.0


def test_inventory_accuracy():
    assert inventory_metrics.inventory_accuracy(system_quantity=98, physical_quantity=100) == 98.0


def test_days_on_hand():
    assert inventory_metrics.days_on_hand(average_inventory=3000, daily_cogs=100) == 30.0


def test_return_rate():
    assert logistics_metrics.return_rate(returned_orders=5, total_orders=100) == 5.0


def test_fill_rate():
    assert logistics_metrics.fill_rate(orders_fulfilled=95, orders_received=100) == 95.0


def test_perfect_order_rate_all_true():
    assert logistics_metrics.perfect_order_rate(
        on_time=True, complete=True, damage_free=True, accurate=True
    ) == 100.0


def test_perfect_order_rate_one_false():
    assert logistics_metrics.perfect_order_rate(
        on_time=True, complete=True, damage_free=False, accurate=True
    ) == 0.0


def test_order_cycle_time():
    created = datetime(2026, 1, 1, tzinfo=timezone.utc)
    delivered = datetime(2026, 1, 3, tzinfo=timezone.utc)
    assert logistics_metrics.order_cycle_time(created, delivered) == 48.0


def test_picking_accuracy():
    assert logistics_metrics.picking_accuracy(correct_picks=997, total_picks=1000) == 99.7


def test_backorder_rate():
    assert logistics_metrics.backorder_rate(backorders=3, total_orders=100) == 3.0


def test_on_time_shipping():
    assert logistics_metrics.on_time_shipping(on_time_deliveries=92, total_deliveries=100) == 92.0


def test_zero_denominators_return_zero():
    assert logistics_metrics.fill_rate(0, 0) == 0.0
    assert logistics_metrics.return_rate(0, 0) == 0.0
    assert logistics_metrics.picking_accuracy(0, 0) == 0.0
    assert logistics_metrics.backorder_rate(0, 0) == 0.0
    assert logistics_metrics.on_time_shipping(0, 0) == 0.0
