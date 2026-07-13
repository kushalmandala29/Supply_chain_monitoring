"""Commodity ETL (config/settings.yaml: etl.commodity, default every 60 minutes).

Pulls commodity market prices from the configured sources, stores history in
PostgreSQL, and publishes an ambient update on commodity.updated so the
Commodity Agent and the frontend's heatmap layer can react.
"""
import json

import redis

from celery_app import app
from config import get_platform_config, get_settings


@app.task(name="tasks.commodity.run")
def run() -> None:
    settings = get_settings()
    platform_config = get_platform_config()
    streams = platform_config.get("redis_streams", {})
    sources = platform_config.get("etl", {}).get("commodity", {}).get("sources", [])

    # TODO: fetch prices from `sources` via settings.commodity_api_base_url /
    # settings.commodity_api_key and append to the commodity_history table
    # in PostgreSQL.
    payload = {"sources": sources, "prices": []}

    client = redis.from_url(settings.redis_url, decode_responses=True)
    client.xadd(streams.get("commodity_updated", "commodity.updated"), {"data": json.dumps(payload)})
