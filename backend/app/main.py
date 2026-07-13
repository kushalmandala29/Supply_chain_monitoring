import asyncio
import sys
import uuid

# psycopg's async mode can't run under Windows' default ProactorEventLoop; it
# needs the selector-based one. Must be set before uvicorn creates the loop.
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from app.api.kpi_router import router as kpi_router
from app.api.map_router import router as map_router
from app.api.websocket import get_map_layers, handle_connection
from app.core.config import get_platform_config, get_settings
from app.core.neo4j_client import close_neo4j_driver

settings = get_settings()

app = FastAPI(title="Jarvis Supply Chain Gateway")

# Build the allowed-origins list from the env variable, then always
# append the wildcard so LAN / WSL2 IPs never get accidentally blocked
# in local dev.  In production, set CORS_ORIGINS to a strict list and
# remove the wildcard entry below.
_cors_origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
if "*" not in _cors_origins:
    _cors_origins.append("*")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=False,   # must be False when allow_origins contains "*"
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(map_router)
app.include_router(kpi_router)


@app.on_event("shutdown")
async def _shutdown() -> None:
    await close_neo4j_driver()


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.get("/config/map-layers")
async def map_layers() -> list[dict]:
    return get_map_layers()


@app.get("/config/kpi-thresholds")
async def kpi_thresholds() -> dict:
    """The `kpi:` section of config/settings.yaml (thresholds/direction/
    interval/alert per KPI) -- lets the frontend display real threshold
    values instead of hardcoding them client-side."""
    return get_platform_config().get("kpi", {})


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    session_id = ws.query_params.get("session_id") or str(uuid.uuid4())
    await handle_connection(ws, session_id)


@app.websocket("/ws/{client_id}")
async def websocket_endpoint_with_path_id(ws: WebSocket, client_id: str) -> None:
    """Alias for clients that put the session/client id in the path
    (/ws/<id>) instead of a session_id query param."""
    session_id = ws.query_params.get("session_id") or client_id
    await handle_connection(ws, session_id)
