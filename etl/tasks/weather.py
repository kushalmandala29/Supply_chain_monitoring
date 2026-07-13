"""Weather ETL (config/settings.yaml: etl.weather, default every 15 minutes).

Fetches current wind/precipitation conditions for every known facility from
Open-Meteo (free, no API key -- the default/always-on source) and derives a
coarse 0-1 weather risk score per entity. Publishes on weather.updated so the
Spatial Agent (agents/spatial/src/main.cpp) can replace its neutral weather
placeholder with a real value, and so the frontend's ambient map layer can
show it.

weather_api/maritime_alerts (keyed providers) are still TODO -- wire them in
via settings.weather_api_key/weather_api_base_url once one is provisioned;
until then Open-Meteo alone covers the "weather" risk component.
"""
import json
import logging

import redis
import requests

from celery_app import app
from config import get_platform_config, get_settings

logger = logging.getLogger(__name__)

# Coarse thresholds turning an instantaneous reading into a 0-1 risk score --
# not a forecast-integrated risk, just "how bad are conditions right now."
GALE_WIND_KMH = 100.0          # ~Category 2 hurricane-force gusts
HEAVY_RAIN_MM_PER_HOUR = 20.0
ALERT_RISK_THRESHOLD = 0.6

# Politeness cap: Open-Meteo's free tier is generous (10k req/day, no key),
# but there's no reason to hit it once per facility if the network grows large.
MAX_FACILITIES_PER_CYCLE = 60


def _weather_risk(wind_speed_kmh: float, precipitation_mm: float) -> float:
    wind_risk = min(wind_speed_kmh / GALE_WIND_KMH, 1.0)
    rain_risk = min(precipitation_mm / HEAVY_RAIN_MM_PER_HOUR, 1.0)
    return round(max(wind_risk, rain_risk), 3)


def _fetch_facilities(settings) -> list[dict]:
    try:
        response = requests.get(f"{settings.gateway_http_url}/map/network", timeout=10)
        response.raise_for_status()
        return response.json().get("nodes", [])[:MAX_FACILITIES_PER_CYCLE]
    except requests.RequestException:
        logger.warning("Weather ETL: could not fetch facilities from /map/network")
        return []


def _fetch_current_conditions(settings, lat: float, lon: float) -> dict | None:
    try:
        response = requests.get(
            settings.open_meteo_base_url,
            params={
                "latitude": lat,
                "longitude": lon,
                "current": "wind_speed_10m,precipitation,weather_code",
            },
            timeout=10,
        )
        response.raise_for_status()
        return response.json().get("current")
    except requests.RequestException:
        return None


@app.task(name="tasks.weather.run")
def run() -> None:
    settings = get_settings()
    platform_config = get_platform_config()
    streams = platform_config.get("redis_streams", {})
    sources = platform_config.get("etl", {}).get("weather", {}).get("sources", [])

    entities: list[dict] = []
    alerts: list[dict] = []

    if "open_meteo" in sources:
        for node in _fetch_facilities(settings):
            current = _fetch_current_conditions(settings, node["lat"], node["lon"])
            if not current:
                continue
            wind = current.get("wind_speed_10m", 0.0)
            precipitation = current.get("precipitation", 0.0)
            risk = _weather_risk(wind, precipitation)
            entities.append({
                "entity_id": node["id"],
                "lat": node["lat"],
                "lon": node["lon"],
                "wind_speed_kmh": wind,
                "precipitation_mm": precipitation,
                "weather_code": current.get("weather_code"),
                "risk": risk,
            })
            if risk >= ALERT_RISK_THRESHOLD:
                alerts.append({"entity_id": node["id"], "label": node.get("name"), "risk": risk})

    # TODO: weather_api/maritime_alerts (keyed providers) once one is
    # provisioned -- see settings.weather_api_key/weather_api_base_url.

    payload = {"sources": sources, "alerts": alerts, "entities": entities}

    client = redis.from_url(settings.redis_url, decode_responses=True)
    client.xadd(streams.get("weather_updated", "weather.updated"), {"data": json.dumps(payload)})
