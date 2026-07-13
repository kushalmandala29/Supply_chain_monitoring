"""Shared config loader for all Python agents. Same pattern as backend/app/core/config.py:
env vars for secrets/connections, config/settings.yaml for tunable platform behavior.
"""
from functools import lru_cache
from pathlib import Path

import yaml
from pydantic_settings import BaseSettings, SettingsConfigDict

_REPO_ROOT = Path(__file__).resolve().parents[2]
_CANDIDATE_PATHS = [
    Path("/config/settings.yaml"),
    _REPO_ROOT / "config" / "settings.yaml",
]


class AgentSettings(BaseSettings):
    # Resolved to the repo-root .env explicitly, since agents are launched as
    # `python agents/<name>/main.py` from various working directories -- a
    # bare ".env" would resolve relative to cwd and could miss the root .env.
    model_config = SettingsConfigDict(env_file=_REPO_ROOT / ".env", extra="ignore")

    redis_url: str = "redis://localhost:6379/0"
    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "kushal@123"
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "supply_chain"
    postgres_user: str = "supply_chain"
    postgres_password: str = "kushal@123"

    news_api_key: str = ""
    news_api_base_url: str = "https://newsapi.org/v2"

    # Supervisor LLM synthesis via OpenRouter's OpenAI-compatible chat API.
    # Default model is a very low-cost non-free model; set OPENROUTER_MODEL
    # to a :free model if you prefer free-tier availability over reliability.
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_model: str = "nex-agi/nex-n2-mini"
    openrouter_site_url: str = ""
    openrouter_app_title: str = "Jarvis Supply Chain Intelligence"


@lru_cache
def get_agent_settings() -> AgentSettings:
    return AgentSettings()


@lru_cache
def get_platform_config() -> dict:
    for path in _CANDIDATE_PATHS:
        if path.exists():
            with path.open("r", encoding="utf-8") as f:
                return yaml.safe_load(f) or {}
    return {}
