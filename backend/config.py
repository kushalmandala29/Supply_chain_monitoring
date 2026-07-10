"""
Supply Chain Risk Intelligence System — Configuration Management
================================================================
Centralized configuration loaded from environment variables.
All API keys, database URIs, and runtime parameters are managed here.
"""

from __future__ import annotations

from pydantic_settings import BaseSettings
from pydantic import Field
import os
from dotenv import load_dotenv

# Load .env file from the project root
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

class ZAIConfig(BaseSettings):
    """Z.AI LLM provider configuration."""
    api_base_url: str = Field(default="https://api.z.ai/api/paas/v4", alias="ZAI_API_BASE_URL")
    api_key: str = Field(default="", alias="ZAI_API_KEY")
    default_model: str = Field(default="glm-5.2", alias="ZAI_DEFAULT_MODEL")
    fast_model: str = Field(default="glm-4.6", alias="ZAI_FAST_MODEL")

    model_config = {"env_prefix": "", "extra": "ignore"}


class GeminiConfig(BaseSettings):
    """Google Gemini LLM provider configuration."""
    api_base_url: str = Field(
        default="https://generativelanguage.googleapis.com/v1beta",
        alias="GEMINI_API_BASE_URL",
    )
    api_key: str = Field(default="", alias="GEMINI_API_KEY")
    flash_model: str = Field(default="gemini-1.5-flash", alias="GEMINI_FLASH_MODEL")
    pro_model: str = Field(default="gemini-1.5-pro", alias="GEMINI_PRO_MODEL")

    model_config = {"env_prefix": "", "extra": "ignore"}


class MCPConfig(BaseSettings):
    """MCP server tool configuration."""
    firecrawl_api_key: str = Field(default="", alias="FIRECRAWL_API_KEY")
    firecrawl_api_url: str = Field(default="https://api.firecrawl.dev", alias="FIRECRAWL_API_URL")
    scrapedo_api_token: str = Field(default="", alias="SCRAPEDO_API_TOKEN")
    geo_cache_dir: str = Field(default="/var/cache/spatial_geojson", alias="GEO_CACHE_DIR")
    spatial_precision: str = Field(default="high", alias="SPATIAL_ENGINE_PRECISION")

    model_config = {"env_prefix": "", "extra": "ignore"}


class PostgresConfig(BaseSettings):
    """PostgreSQL / PostGIS database configuration."""
    host: str = Field(default="localhost", alias="POSTGRES_HOST")
    port: int = Field(default=5432, alias="POSTGRES_PORT")
    database: str = Field(default="risk_intelligence", alias="POSTGRES_DB")
    user: str = Field(default="db_orchestrator", alias="POSTGRES_USER")
    password: str = Field(default="", alias="POSTGRES_PASSWORD")
    shadow_schema: str = Field(default="shadow_whatif", alias="SHADOW_DB_SCHEMA")

    @property
    def dsn(self) -> str:
        return f"postgresql://{self.user}:{self.password}@{self.host}:{self.port}/{self.database}"

    @property
    def async_dsn(self) -> str:
        return f"postgresql+asyncpg://{self.user}:{self.password}@{self.host}:{self.port}/{self.database}"

    model_config = {"env_prefix": "", "extra": "ignore"}


class DynamoDBConfig(BaseSettings):
    """Amazon DynamoDB configuration."""
    table_name: str = Field(default="supply-chain-swarm-memory", alias="DYNAMODB_TABLE_NAME")
    region: str = Field(default="us-east-1", alias="DYNAMODB_REGION")

    model_config = {"env_prefix": "", "extra": "ignore"}


class Neo4jConfig(BaseSettings):
    """Neo4j AuraDB configuration."""
    uri: str = Field(default="", alias="NEO4J_URI")
    user: str = Field(default="swarm_orchestrator_node", alias="NEO4J_USER")
    password: str = Field(default="", alias="NEO4J_PASSWORD")

    model_config = {"env_prefix": "", "extra": "ignore"}


class AppConfig(BaseSettings):
    """Application-level runtime configuration."""
    host: str = Field(default="0.0.0.0", alias="BACKEND_HOST")
    port: int = Field(default=8000, alias="BACKEND_PORT")
    cors_origins: str = Field(
        default="http://localhost:5173,http://localhost:3000",
        alias="BACKEND_CORS_ORIGINS",
    )
    ws_ping_interval: int = Field(default=600, alias="WS_PING_INTERVAL_SECONDS")
    ws_idle_timeout: int = Field(default=7200, alias="WS_IDLE_TIMEOUT_SECONDS")
    debate_max_iterations: int = Field(default=3, alias="DEBATE_MAX_ITERATIONS")
    zscore_threshold: float = Field(default=2.5, alias="ZSCORE_ANOMALY_THRESHOLD")
    sqs_queue_url: str = Field(default="", alias="SQS_QUEUE_URL")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]

    model_config = {"env_prefix": "", "extra": "ignore"}


class Settings:
    """Aggregated settings container for the entire application."""

    def __init__(self) -> None:
        self.zai = ZAIConfig()
        self.gemini = GeminiConfig()
        self.mcp = MCPConfig()
        self.postgres = PostgresConfig()
        self.dynamodb = DynamoDBConfig()
        self.neo4j = Neo4jConfig()
        self.app = AppConfig()


# Singleton settings instance
settings = Settings()
