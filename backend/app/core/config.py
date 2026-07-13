"""Loads runtime configuration from environment variables and config/settings.yaml.

Nothing geographic or provider-specific is hardcoded here -- see config/settings.yaml
for the tunables (ETL schedules, risk thresholds, query-router intent map, ...).
"""
from functools import lru_cache
from pathlib import Path

import yaml
from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[3]
SETTINGS_YAML_PATH = REPO_ROOT / "config" / "settings.yaml"


class Settings(BaseSettings):
    # Resolved to the repo-root .env explicitly (rather than the bare ".env"
    # pydantic-settings would look for relative to the current working
    # directory) so this loads correctly no matter which directory you launch
    # the gateway from.
    model_config = SettingsConfigDict(env_file=REPO_ROOT / ".env", extra="ignore")

    redis_url: str = "redis://localhost:6379/0"
    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "change-me"
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "supply_chain"
    postgres_user: str = "supply_chain"
    postgres_password: str = "change-me"
    gateway_host: str = "0.0.0.0"
    gateway_port: int = 8000
    jwt_secret: str = "change-me"
    cors_origins: str = "http://localhost:5173,http://localhost:3000,http://172.31.98.253:5173,http://172.31.98.253:3000"


@lru_cache
def get_settings() -> Settings:
    return Settings()


@lru_cache
def get_platform_config() -> dict:
    """The shared, hot-reloadable config/settings.yaml (ETL schedules, risk
    thresholds, query-router intent map, agent priorities, map layers, ...)."""
    if not SETTINGS_YAML_PATH.exists():
        return {}
    with SETTINGS_YAML_PATH.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}
