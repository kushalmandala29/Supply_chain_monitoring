"""Satellite ETL (config/settings.yaml: etl.satellite, default every 45 minutes).

Constructs NASA GIBS WMTS tile URL templates (free, no API key -- see
settings.nasa_gibs_base_url) for the standard MODIS Terra true-color daily
composite, and publishes them on satellite.ready so the frontend's satellite
overlay and the Vision Agent (agents/vision/main.py, which builds the same
template for a query's resolved location) can render/reference them.

GIBS tiles are global (WMTS, not a per-region fetch) -- the ETL's job is just
publishing the current template/date; {z}/{y}/{x} are filled in by whatever
map viewer is showing a given region.
"""
import json
from datetime import date, timedelta

import redis

from celery_app import app
from config import get_platform_config, get_settings

# MODIS Terra Corrected Reflectance (True Color) -- one of GIBS's standard,
# well-documented layers; daily composite with ~1 day publication latency,
# so "yesterday" is used since today's tiles are usually not yet available.
GIBS_LAYER = "MODIS_Terra_CorrectedReflectance_TrueColor"
GIBS_TILE_MATRIX_SET = "250m"
GIBS_FORMAT = "jpg"
GIBS_SNAPSHOT_URL = "https://wvs.earthdata.nasa.gov/api/v1/snapshot"
# Ambient (no specific query location) snapshot -- a wide equatorial band,
# same idea as the Vision Agent's per-query snapshot but centered on the map.
AMBIENT_SNAPSHOT_BBOX = "-60,-180,60,180"
SNAPSHOT_WIDTH = 1024
SNAPSHOT_HEIGHT = 512


def _tile_url_template(base_url: str, imagery_date: str) -> str:
    return f"{base_url}/{GIBS_LAYER}/default/{imagery_date}/{GIBS_TILE_MATRIX_SET}/{{z}}/{{y}}/{{x}}.{GIBS_FORMAT}"


def _ambient_snapshot_url(imagery_date: str) -> str:
    return (
        f"{GIBS_SNAPSHOT_URL}?REQUEST=GetSnapshot&LAYERS={GIBS_LAYER}&CRS=EPSG:4326"
        f"&TIME={imagery_date}&BBOX={AMBIENT_SNAPSHOT_BBOX}"
        f"&FORMAT=image/jpeg&WIDTH={SNAPSHOT_WIDTH}&HEIGHT={SNAPSHOT_HEIGHT}"
    )


@app.task(name="tasks.satellite.run")
def run() -> None:
    settings = get_settings()
    platform_config = get_platform_config()
    streams = platform_config.get("redis_streams", {})
    sources = platform_config.get("etl", {}).get("satellite", {}).get("sources", [])

    imagery = []
    if "nasa_gibs" in sources:
        imagery_date = (date.today() - timedelta(days=1)).isoformat()
        imagery.append({
            "layer": GIBS_LAYER,
            "date": imagery_date,
            "tile_url_template": _tile_url_template(settings.nasa_gibs_base_url, imagery_date),
            "snapshot_url": _ambient_snapshot_url(imagery_date),
            "description": "MODIS Terra true-color daily composite",
        })

    payload = {"sources": sources, "imagery": imagery}

    client = redis.from_url(settings.redis_url, decode_responses=True)
    client.xadd(streams.get("satellite_ready", "satellite.ready"), {"data": json.dumps(payload)})
