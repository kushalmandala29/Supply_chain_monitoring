"""Satellite ETL (config/settings.yaml: etl.satellite, default every 45 minutes).

Pulls imagery from the configured sources (NASA GIBS), and publishes an
ambient update on satellite.ready so the Vision Agent and the frontend's
satellite windows can react.
"""
import json

import redis

from celery_app import app
from config import get_platform_config, get_settings


@app.task(name="tasks.satellite.run")
def run() -> None:
    settings = get_settings()
    platform_config = get_platform_config()
    streams = platform_config.get("redis_streams", {})
    sources = platform_config.get("etl", {}).get("satellite", {}).get("sources", [])

    # TODO: fetch imagery tiles from `sources` via settings.nasa_gibs_base_url
    # (WMTS/WMS, no API key required) and store references alongside their
    # geofence coverage in PostGIS.
    payload = {"sources": sources, "imagery": []}

    client = redis.from_url(settings.redis_url, decode_responses=True)
    client.xadd(streams.get("satellite_ready", "satellite.ready"), {"data": json.dumps(payload)})
