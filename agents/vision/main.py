"""Vision Agent: retrieves satellite imagery for a query's geographic entity.

Resolves the query to a location via OpenStreetMap Nominatim (free, no key --
same service etl/tasks/news.py uses for article geocoding), then returns a
NASA GIBS WMTS tile URL template (same construction as etl/tasks/satellite.py,
free/keyless) centered on it. Cloud-cover/storm-movement *analysis* of the
imagery itself is not implemented -- this resolves "where" and hands back a
real, renderable tile reference, not a computer-vision judgment.
"""
import re
import sys
import time
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import requests

# Makes `agents/common` importable whether this runs from Docker (where it's
# copied in as a sibling of main.py) or natively from the repo (where it's
# one level up, under agents/).
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from common.base_agent import BaseAgent, run_agent

NOMINATIM_USER_AGENT = "jarvis-supply-chain-intelligence/0.1"
GIBS_BASE_URL = "https://gibs.earthdata.nasa.gov/wmts/epsg4326/best"
GIBS_SNAPSHOT_URL = "https://wvs.earthdata.nasa.gov/api/v1/snapshot"
GIBS_LAYER = "MODIS_Terra_CorrectedReflectance_TrueColor"
GIBS_TILE_MATRIX_SET = "250m"
GIBS_FORMAT = "jpg"
# Regional view around the resolved point -- wide enough to show real
# geographic context (coastline, strait, nearby land) without needing the
# frontend to do any tile math; the Worldview Snapshot API stitches this into
# one directly-loadable JPEG.
SNAPSHOT_HALF_DEGREES = 3.0
SNAPSHOT_WIDTH = 640
SNAPSHOT_HEIGHT = 640

# Same stopword-filtered proper-noun heuristic as etl/tasks/news.py's
# _candidate_places -- Nominatim is a structured place geocoder, not a
# natural-language search engine, so "storms near the Taiwan Strait" needs to
# be reduced to "Taiwan" before it resolves. Weather/disaster/supply-chain
# jargon is capitalized in queries just as often as real place names ("Show
# me the Typhoon near Taiwan Strait") and Nominatim will happily geocode
# "Typhoon" to some unrelated street literally named that -- so those words
# are excluded from candidates entirely rather than just deprioritized.
_STOPWORDS = {
    "The", "A", "An", "In", "On", "At", "To", "For", "Of", "And", "Or", "But",
    "Is", "Are", "Was", "Were", "Near", "Show", "What", "Where", "How", "Why",
}
_NON_PLACE_WORDS = {
    "Typhoon", "Storm", "Storms", "Hurricane", "Cyclone", "Flood", "Flooding",
    "Earthquake", "Drought", "Heatwave", "Blizzard", "Tornado", "Wildfire",
    "Wildfires", "Disruption", "Disruptions", "Delay", "Delays", "Congestion",
    "Crisis", "Risk", "Zone", "Alert", "Warning", "Weather", "Satellite",
    "Imagery", "Port", "Ports", "Shipping", "Route", "Routes", "Supply", "Chain",
}


def _candidate_places(text: str) -> list[str]:
    words = re.findall(r"\b[A-Z][a-zA-Z]+\b", text)
    seen: set[str] = set()
    candidates = []
    for word in words:
        if word in _STOPWORDS or word in _NON_PLACE_WORDS or word in seen:
            continue
        seen.add(word)
        candidates.append(word)
    return candidates[:3]


def _geocode(query: str) -> dict | None:
    try:
        response = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": query, "format": "jsonv2", "limit": 1},
            headers={"User-Agent": NOMINATIM_USER_AGENT},
            timeout=10,
        )
        response.raise_for_status()
        results = response.json()
    except requests.RequestException:
        return None
    if not results:
        return None
    top = results[0]
    return {"lat": float(top["lat"]), "lon": float(top["lon"]), "label": top.get("display_name")}


def _snapshot_url(lat: float, lon: float, imagery_date: str) -> str:
    south = max(lat - SNAPSHOT_HALF_DEGREES, -90.0)
    north = min(lat + SNAPSHOT_HALF_DEGREES, 90.0)
    west = max(lon - SNAPSHOT_HALF_DEGREES, -180.0)
    east = min(lon + SNAPSHOT_HALF_DEGREES, 180.0)
    return (
        f"{GIBS_SNAPSHOT_URL}?REQUEST=GetSnapshot&LAYERS={GIBS_LAYER}&CRS=EPSG:4326"
        f"&TIME={imagery_date}&BBOX={south},{west},{north},{east}"
        f"&FORMAT=image/jpeg&WIDTH={SNAPSHOT_WIDTH}&HEIGHT={SNAPSHOT_HEIGHT}"
    )


def _geocode_query(text: str) -> dict | None:
    # A handful of sequential candidates for one query -- unlike news.py's
    # batch-of-headlines loop, this doesn't need an inter-request sleep to
    # respect Nominatim's ~1 req/sec usage policy.
    for candidate in _candidate_places(text):
        location = _geocode(candidate)
        if location:
            return location
        time.sleep(1)
    return None


class VisionAgent(BaseAgent):
    name = "vision"
    output_stream_key = "satellite_ready"

    async def handle(self, routed_query: dict[str, Any]) -> dict[str, Any] | None:
        query = routed_query["query"]
        location = _geocode_query(query)
        if not location:
            return {
                "query": query,
                "imagery": [],
                "note": f"Could not resolve a location for satellite imagery from: {query!r}",
            }

        imagery_date = (date.today() - timedelta(days=1)).isoformat()
        tile_url_template = (
            f"{GIBS_BASE_URL}/{GIBS_LAYER}/default/{imagery_date}/{GIBS_TILE_MATRIX_SET}/{{z}}/{{y}}/{{x}}.{GIBS_FORMAT}"
        )
        return {
            "query": query,
            "center": {"lat": location["lat"], "lon": location["lon"], "label": location.get("label")},
            "imagery": [{
                "layer": GIBS_LAYER,
                "date": imagery_date,
                "tile_url_template": tile_url_template,
                # A single directly-loadable JPEG (no tile math needed) for
                # the frontend to just <img src=...> -- the WMTS template
                # above stays available for anyone building a real map layer.
                "snapshot_url": _snapshot_url(location["lat"], location["lon"], imagery_date),
                "description": "MODIS Terra true-color daily composite",
            }],
        }


if __name__ == "__main__":
    run_agent(VisionAgent())
