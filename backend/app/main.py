import asyncio
import sys
import uuid

# psycopg's async mode can't run under Windows' default ProactorEventLoop; it
# needs the selector-based one. Must be set before uvicorn creates the loop.
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from app.api.map_router import router as map_router
from app.api.websocket import get_map_layers, handle_connection
from app.core.config import get_settings
from app.core.neo4j_client import close_neo4j_driver

settings = get_settings()

app = FastAPI(title="Jarvis Supply Chain Gateway")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(map_router)


@app.on_event("shutdown")
async def _shutdown() -> None:
    await close_neo4j_driver()


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.get("/config/map-layers")
async def map_layers() -> list[dict]:
    return get_map_layers()


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
