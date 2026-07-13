from datetime import datetime

from pydantic import BaseModel


class OrderShippedPayload(BaseModel):
    order_id: str
    supplier_id: str | None = None
    warehouse_id: str | None = None
    route_id: str | None = None
    order_created_at: datetime
    shipped_at: datetime


class OrderDeliveredPayload(BaseModel):
    order_id: str
    delivered_at: datetime
    on_time_flag: bool
    picked_correctly: bool
    damaged_flag: bool = False


class OrderReturnedPayload(BaseModel):
    order_id: str
    returned_at: datetime


class OrderDamagedPayload(BaseModel):
    order_id: str
    damaged_flag: bool = True


class InventoryUpdatePayload(BaseModel):
    warehouse_id: str
    sku_id: str
    inventory_count: int
    inventory_value: float
    system_quantity: float | None = None
    physical_quantity: float | None = None
    cogs: float | None = None
    daily_cogs: float | None = None


class KpiFact(BaseModel):
    id: int
    entity_id: str
    entity_type: str
    kpi_name: str
    kpi_value: float
    period_start: str
    period_end: str
    computed_at: str
    created_at: str
    severity: str
    alert: bool


class KpiAlert(BaseModel):
    entity_id: str
    entity_type: str
    kpi: str
    current: float
    threshold: float | None
    severity: str
    timestamp: str
