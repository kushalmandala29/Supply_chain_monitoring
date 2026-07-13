"""Publishes KPI facts onto the shared Redis blackboard, using the same
StreamBus/logical-stream-key convention every other stream in the platform
uses (see app/core/redis_streams.py). Payloads carry no session_id, so the
existing gateway forwarder loop (app/api/websocket.py) broadcasts them to
every connected client, exactly like the ambient ETL streams.
"""
from datetime import datetime, timezone
from typing import Any

from app.core.redis_streams import StreamBus
from app.services.kpi import threshold_engine


async def publish_kpi_update(bus: StreamBus, fact: dict[str, Any]) -> None:
    await bus.publish("kpi_update", fact)


async def publish_kpi_alert(bus: StreamBus, fact: dict[str, Any]) -> None:
    if not fact.get("alert"):
        return
    alert = {
        "entity_id": fact["entity_id"],
        "entity_type": fact["entity_type"],
        "kpi": fact["kpi_name"],
        "current": fact["kpi_value"],
        "threshold": threshold_engine.threshold_for(fact["kpi_name"]),
        "severity": fact["severity"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    await bus.publish("kpi_alert", alert)
