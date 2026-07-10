-- ==============================================================================
-- Supply Chain Risk Intelligence System — PostgreSQL + PostGIS Schema
-- ==============================================================================
-- Initializes spatial engine capabilities, relational price matrices,
-- spatial disruption logs, and shadow database for What-If simulations.
-- Spec Reference: §11 Database Activation & Indexing Configurations
-- ==============================================================================

-- Step 1: Initialize Spatial Engine Capabilities
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- PRODUCTION SCHEMA (Live Operational State)
-- ==============================================================================

-- Step 2: Establish Relational Price Matrix Architecture
CREATE TABLE IF NOT EXISTS commodity_price_ticks (
    tick_id         BIGSERIAL PRIMARY KEY,
    commodity_code  VARCHAR(50) NOT NULL,
    spot_price      NUMERIC(12, 4) NOT NULL,
    currency        VARCHAR(3) DEFAULT 'USD',
    source_feed     VARCHAR(100),
    recorded_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Step 3: Establish Spatial Disruption Log
CREATE TABLE IF NOT EXISTS spatial_risk_events (
    event_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_feed         VARCHAR(255) NOT NULL,
    headline            TEXT NOT NULL,
    summary             TEXT,
    geo_coordinates     GEOMETRY(Point, 4326),
    affected_region     GEOMETRY(Polygon, 4326),
    computed_risk_score NUMERIC(3, 2),
    severity_level      VARCHAR(20) DEFAULT 'medium',
    is_active           BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at         TIMESTAMP WITH TIME ZONE
);

-- Step 4: Agent Execution Audit Log
CREATE TABLE IF NOT EXISTS agent_execution_log (
    log_id          BIGSERIAL PRIMARY KEY,
    thread_id       UUID NOT NULL,
    agent_name      VARCHAR(50) NOT NULL,
    model_used      VARCHAR(100) NOT NULL,
    input_tokens    INTEGER,
    output_tokens   INTEGER,
    execution_ms    INTEGER,
    status          VARCHAR(20) DEFAULT 'completed',
    error_message   TEXT,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Step 5: Synthesis Critic Validated Payloads
CREATE TABLE IF NOT EXISTS validated_risk_assessments (
    assessment_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id           UUID NOT NULL,
    trigger_source      VARCHAR(50) NOT NULL,
    risk_summary        TEXT NOT NULL,
    affected_corridors  JSONB,
    financial_impact    JSONB,
    debate_rounds       INTEGER DEFAULT 0,
    confidence_score    NUMERIC(3, 2),
    ui_layout_schema    JSONB,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- SHADOW SCHEMA (Isolated What-If Sandbox)
-- ==============================================================================

CREATE SCHEMA IF NOT EXISTS shadow_whatif;

CREATE TABLE IF NOT EXISTS shadow_whatif.simulated_events (
    simulation_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scenario_label      TEXT NOT NULL,
    injected_parameters JSONB NOT NULL,
    affected_region     GEOMETRY(Polygon, 4326),
    computed_impacts    JSONB,
    created_by          VARCHAR(100),
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shadow_whatif.simulated_price_impacts (
    impact_id           BIGSERIAL PRIMARY KEY,
    simulation_id       UUID REFERENCES shadow_whatif.simulated_events(simulation_id),
    commodity_code      VARCHAR(50) NOT NULL,
    baseline_price      NUMERIC(12, 4),
    projected_price     NUMERIC(12, 4),
    delta_percent       NUMERIC(6, 2),
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- PERFORMANCE INDEXES
-- ==============================================================================

-- Fast commodity price lookups by code and recency
CREATE INDEX IF NOT EXISTS idx_commodity_ticks_lookup
ON commodity_price_ticks (commodity_code, recorded_at DESC);

-- Spatial risk event geospatial index (GIST)
CREATE INDEX IF NOT EXISTS idx_spatial_risk_geo_gist
ON spatial_risk_events USING GIST(geo_coordinates);

-- Spatial risk event affected region index
CREATE INDEX IF NOT EXISTS idx_spatial_risk_region_gist
ON spatial_risk_events USING GIST(affected_region);

-- Agent execution log lookups by thread
CREATE INDEX IF NOT EXISTS idx_agent_log_thread
ON agent_execution_log (thread_id, created_at DESC);

-- Validated assessments by recency
CREATE INDEX IF NOT EXISTS idx_assessments_created
ON validated_risk_assessments (created_at DESC);

-- Shadow simulation lookups
CREATE INDEX IF NOT EXISTS idx_shadow_events_created
ON shadow_whatif.simulated_events (created_at DESC);
