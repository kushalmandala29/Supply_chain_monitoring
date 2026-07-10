"""
Supply Chain Risk Intelligence System — FastAPI Entry Point
============================================================
Mounts the WebSocket endpoint, REST API routes, CORS middleware,
and initializes the LangGraph computational swarm.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from backend.config import settings
from backend.database.postgres import PostgresPool
from backend.database.dynamodb import DynamoDBStore
from backend.database.neo4j_db import Neo4jDriver
from backend.graph.builder import build_swarm_graph
from backend.websocket.manager import ConnectionManager
from backend.websocket.handlers import handle_ws_message
from backend.models.schemas import (
    AnalystQueryRequest,
    AnalystQueryResponse,
    HealthCheckResponse,
    ScenarioInjectionRequest,
)

load_dotenv()

logger = logging.getLogger("scri")
logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(name)s | %(levelname)s | %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan — initialize and tear down shared resources."""
    logger.info("🚀 Initializing Supply Chain Risk Intelligence System v8.0")

    # Initialize database pools
    app.state.pg_pool = PostgresPool()
    await app.state.pg_pool.connect()

    app.state.dynamo = DynamoDBStore()
    app.state.neo4j = Neo4jDriver()
    await app.state.neo4j.connect()

    # Build the LangGraph computational swarm
    app.state.swarm_graph = build_swarm_graph()

    # WebSocket connection manager
    app.state.ws_manager = ConnectionManager()

    logger.info("✅ All systems initialized — Cognitive Control Tower online")
    yield

    # Teardown
    logger.info("🛑 Shutting down...")
    await app.state.pg_pool.disconnect()
    await app.state.neo4j.disconnect()
    logger.info("👋 Shutdown complete")


app = FastAPI(
    title="Supply Chain Risk Intelligence System",
    description="Multi-Agent Cognitive Control Tower — v8.0",
    version="8.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.app.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==============================================================================
# REST API Endpoints
# ==============================================================================

@app.get("/health", response_model=HealthCheckResponse, tags=["System"])
async def health_check() -> HealthCheckResponse:
    """System health and readiness check."""
    return HealthCheckResponse(
        status="operational",
        version="8.0.0",
        agents_online=True,
    )


@app.post("/api/v1/query", response_model=AnalystQueryResponse, tags=["Analysis"])
async def submit_analyst_query(request: AnalystQueryRequest) -> AnalystQueryResponse:
    """
    Submit an analyst query to the multi-agent swarm.
    The Supervisor Agent routes the query to appropriate specialized agents.
    """
    from backend.graph.builder import invoke_swarm

    result = await invoke_swarm(
        graph=app.state.swarm_graph,
        query=request.query,
        trigger_source="analyst_query",
        coordinates=request.coordinates,
    )

    return AnalystQueryResponse(
        thread_id=result["thread_id"],
        risk_summary=result.get("risk_summary", ""),
        financial_impact=result.get("financial_impact_kpis", {}),
        ui_layout_schema=result.get("target_ui_schema", {}),
        agents_invoked=result.get("agents_invoked", []),
    )


@app.post("/api/v1/scenario", response_model=AnalystQueryResponse, tags=["Simulation"])
async def inject_scenario(request: ScenarioInjectionRequest) -> AnalystQueryResponse:
    """
    Inject a What-If scenario into the shadow simulation sandbox.
    Executes the swarm against an isolated shadow database.
    """
    from backend.graph.builder import invoke_swarm

    result = await invoke_swarm(
        graph=app.state.swarm_graph,
        query=request.scenario_description,
        trigger_source="synthetic_simulation",
        coordinates=request.coordinates,
        parameters=request.parameters,
    )

    return AnalystQueryResponse(
        thread_id=result["thread_id"],
        risk_summary=result.get("risk_summary", ""),
        financial_impact=result.get("financial_impact_kpis", {}),
        ui_layout_schema=result.get("target_ui_schema", {}),
        agents_invoked=result.get("agents_invoked", []),
    )


# ==============================================================================
# WebSocket Endpoint — Real-Time Agent Trace Stream
# ==============================================================================

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str) -> None:
    """
    Real-time bidirectional communication channel.
    Streams agent cognitive traces, debate logs, and UI layout updates.
    Implements 10-minute ping loop per spec §9 deployment constraints.
    """
    manager: ConnectionManager = app.state.ws_manager
    await manager.connect(websocket, client_id)

    try:
        while True:
            data = await websocket.receive_json()
            await handle_ws_message(
                manager=manager,
                client_id=client_id,
                message=data,
                swarm_graph=app.state.swarm_graph,
            )
    except WebSocketDisconnect:
        manager.disconnect(client_id)
        logger.info(f"Client {client_id} disconnected")


# ==============================================================================
# Application Runner
# ==============================================================================

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "backend.main:app",
        host=settings.app.host,
        port=settings.app.port,
        reload=True,
        log_level="info",
    )
