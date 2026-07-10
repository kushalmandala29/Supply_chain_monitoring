"""
Pydantic Request/Response Schemas
===================================
REST API and WebSocket message schemas for the Supply Chain Risk Intelligence System.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


# ==============================================================================
# Health Check
# ==============================================================================

class HealthCheckResponse(BaseModel):
    """System health check response."""
    status: str = Field(description="System operational status")
    version: str = Field(description="Application version")
    agents_online: bool = Field(description="Whether the agent swarm is initialized")


# ==============================================================================
# Analyst Query
# ==============================================================================

class AnalystQueryRequest(BaseModel):
    """Analyst query submission to the multi-agent swarm."""
    query: str = Field(description="Natural language query or event description")
    coordinates: list[float] | None = Field(
        default=None,
        description="Optional [lat, lng] focal coordinates",
    )


class AnalystQueryResponse(BaseModel):
    """Response from the multi-agent swarm analysis."""
    thread_id: str = Field(description="Unique execution thread identifier")
    risk_summary: str = Field(description="Synthesized risk assessment")
    financial_impact: dict[str, Any] = Field(
        default_factory=dict,
        description="Financial KPI impact breakdown",
    )
    ui_layout_schema: dict[str, Any] = Field(
        default_factory=dict,
        description="Dynamic UI layout specification for the frontend",
    )
    agents_invoked: list[str] = Field(
        default_factory=list,
        description="List of agents that participated",
    )


# ==============================================================================
# Scenario Simulation (What-If)
# ==============================================================================

class ScenarioInjectionRequest(BaseModel):
    """What-If scenario injection into the shadow simulation sandbox."""
    scenario_description: str = Field(
        description="Natural language description of the simulated scenario",
    )
    coordinates: list[float] | None = Field(
        default=None,
        description="Optional [lat, lng] for spatial targeting",
    )
    parameters: dict[str, Any] = Field(
        default_factory=dict,
        description="Slider parameters: transit_days_delay, capacity_percent, freight_cost_premium",
    )


class SimulationSliderParameters(BaseModel):
    """War Room parameter slider values for scenario modulation."""
    transit_days_delay: int = Field(default=0, ge=0, le=90)
    operational_capacity_percent: float = Field(default=100.0, ge=0.0, le=100.0)
    freight_cost_premium_usd: float = Field(default=0.0, ge=0.0)


# ==============================================================================
# WebSocket Messages
# ==============================================================================

class WSInboundMessage(BaseModel):
    """Inbound WebSocket message from the client."""
    type: str = Field(description="Message type: query | scenario | ping")
    payload: dict[str, Any] = Field(default_factory=dict)


class WSOutboundMessage(BaseModel):
    """Outbound WebSocket message to the client."""
    type: str = Field(
        description="Message type: agent_trace | layout_update | debate_step | error | pong",
    )
    agent: str | None = Field(default=None, description="Source agent name")
    payload: dict[str, Any] = Field(default_factory=dict)


# ==============================================================================
# Entity Extraction Results
# ==============================================================================

class ExtractedEntity(BaseModel):
    """Structured entity extracted by the Intelligence Agent."""
    entity_type: str = Field(description="Entity category: port | node | cargo | vessel | route")
    name: str = Field(description="Entity name")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    coordinates: list[float] | None = Field(default=None)
    metadata: dict[str, Any] = Field(default_factory=dict)


# ==============================================================================
# Risk Assessment
# ==============================================================================

class RiskAssessment(BaseModel):
    """Validated risk assessment from the Synthesis Critic."""
    assessment_id: str
    thread_id: str
    trigger_source: str
    risk_summary: str
    affected_corridors: list[dict[str, Any]] = Field(default_factory=list)
    financial_impact: dict[str, Any] = Field(default_factory=dict)
    debate_rounds: int = 0
    confidence_score: float = Field(ge=0.0, le=1.0)
    ui_layout_schema: dict[str, Any] = Field(default_factory=dict)
