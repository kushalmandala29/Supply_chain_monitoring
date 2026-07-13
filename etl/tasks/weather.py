"""Weather ETL (config/settings.yaml: etl.weather, default every 15 minutes).

Pulls weather/maritime alerts from the configured sources, resolves affected
geographies, and upserts geofence polygons into PostGIS. Publishes an ambient
update on weather.updated for the ambient map layer and any agent watching
for storm/weather risk.
"""
import json

import redis

from celery_app import app
from config import get_platform_config, get_settings


@app.task(name="tasks.weather.run")
def run() -> None:
    settings = get_settings()
    platform_config = get_platform_config()
    streams = platform_config.get("redis_streams", {})
    sources = platform_config.get("etl", {}).get("weather", {}).get("sources", [])

    # TODO: fetch alerts from `sources` via settings.weather_api_base_url /
    # settings.weather_api_key, geocode affected regions, and upsert
    # geofence polygons into PostGIS.
    payload = {"sources": sources, "alerts": []}

    client = redis.from_url(settings.redis_url, decode_responses=True)
    client.xadd(streams.get("weather_updated", "weather.updated"), {"data": json.dumps(payload)})
