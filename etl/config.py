"""Config loader for the ETL pipelines. Same env-vars + config/settings.yaml
pattern used by the backend gateway and the agents.
"""
from functools import lru_cache
from pathlib import Path

import yaml
from pydantic_settings import BaseSettings, SettingsConfigDict

_REPO_ROOT = Path(__file__).resolve().parents[1]
_CANDIDATE_PATHS = [
    Path("/config/settings.yaml"),
    _REPO_ROOT / "config" / "settings.yaml",
]


class Settings(BaseSettings):
    # Resolved to the repo-root .env explicitly, since the ETL services are
    # launched with `cd etl` first -- a bare ".env" would resolve relative to
    # that cwd and miss the root .env entirely.
    model_config = SettingsConfigDict(env_file=_REPO_ROOT / ".env", extra="ignore")

    redis_url: str = "redis://localhost:6379/0"
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "supply_chain"
    postgres_user: str = "supply_chain"
    postgres_password: str = "change-me"

    news_api_key: str = ""
    news_api_base_url: str = "https://newsapi.org/v2"
    gdelt_base_url: str = "https://api.gdeltproject.org/api/v2"
    reliefweb_base_url: str = "https://api.reliefweb.int/v1"
    weather_api_key: str = ""
    weather_api_base_url: str = ""
    # Open-Meteo serves current conditions + forecasts publicly, no API key
    # required -- the default weather source (see etl/tasks/weather.py) so
    # weather risk works out of the box without provisioning a keyed provider.
    open_meteo_base_url: str = "https://api.open-meteo.com/v1/forecast"
    commodity_api_key: str = ""
    commodity_api_base_url: str = ""
    # NASA GIBS serves imagery tiles (WMTS/WMS) publicly, no API key required.
    nasa_gibs_base_url: str = "https://gibs.earthdata.nasa.gov/wmts/epsg4326/best"
    # Where the ETL can read facility locations from (reuses the existing
    # gateway endpoint rather than adding a second direct DB dependency).
    gateway_http_url: str = "http://localhost:8010"


@lru_cache
def get_settings() -> Settings:
    return Settings()


@lru_cache
def get_platform_config() -> dict:
    for path in _CANDIDATE_PATHS:
        if path.exists():
            with path.open("r", encoding="utf-8") as f:
                return yaml.safe_load(f) or {}
    return {}
