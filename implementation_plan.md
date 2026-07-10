# Multi-Agent Supply Chain Risk Intelligence System — File Scaffold Plan

## Goal

Generate the complete file and folder structure for the v8.0 Cognitive Control Tower based on the enterprise specification. This includes the Python backend (LangGraph multi-agent swarm), React/Vite frontend (Digital Twin Canvas), AWS infrastructure (Terraform IaC), database schemas, MCP server configs, and Lambda functions.

---

## Proposed Directory Structure

```
new_supply_chain/
├── README.md                          # Project overview & setup guide
├── .env.example                       # Environment variable template
├── .gitignore                         # Git ignore rules
├── mcp.json                           # MCP server & LLM provider manifest
├── docker-compose.yml                 # Local dev stack (Postgres, Neo4j, etc.)
├── pyproject.toml                     # Python project metadata
│
├── infrastructure/
│   ├── terraform/
│   │   ├── main.tf                    # Core AWS resources (SQS, DynamoDB, RDS, Lambda)
│   │   ├── variables.tf               # Configurable Terraform variables
│   │   ├── outputs.tf                 # Exported resource ARNs/URLs
│   │   └── terraform.tfvars.example   # Variable defaults template
│   └── sql/
│       └── init_postgis.sql           # PostGIS extensions + table schemas
│
├── backend/
│   ├── __init__.py
│   ├── main.py                        # FastAPI + WebSocket entry point
│   ├── config.py                      # Centralized config from env vars
│   ├── requirements.txt               # Python dependencies
│   │
│   ├── models/
│   │   ├── __init__.py
│   │   ├── state.py                   # LangGraph SwarmState TypedDict
│   │   └── schemas.py                 # Pydantic request/response schemas
│   │
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── supervisor.py              # 🧠 Supervisor (Z.AI GLM-5.2)
│   │   ├── intelligence.py            # 🕵️ Intel Agent (Gemini 1.5 Flash)
│   │   ├── vision.py                  # 👁️ Vision Agent (Gemini 1.5 Pro)
│   │   ├── spatial.py                 # 🗺️ Spatial Agent (Gemini 1.5 Flash)
│   │   ├── geopolitical.py            # 🌍 Geopolitical Agent (Gemini Flash)
│   │   ├── logistics.py               # 🚢 Logistics Agent (Z.AI GLM-5.2)
│   │   ├── finance.py                 # 💰 Finance Agent (Z.AI GLM-4.6)
│   │   └── synthesis.py               # ⚖️ Synthesis Critic (Z.AI GLM-5.2)
│   │
│   ├── graph/
│   │   ├── __init__.py
│   │   ├── builder.py                 # LangGraph StateGraph construction
│   │   ├── routing.py                 # Conditional edge routing logic
│   │   └── debate.py                  # Adversarial Geo↔Logistics loop (N_max=3)
│   │
│   ├── tools/
│   │   ├── __init__.py
│   │   ├── firecrawl_client.py        # Firecrawl MCP tool wrapper
│   │   ├── scrape_do_client.py        # Scrape.do anti-bot proxy tool
│   │   ├── spatial_engine.py          # C++ Spatial Engine MCP tool
│   │   ├── sql_analytics.py           # SQL Analytics MCP tool
│   │   └── neo4j_client.py            # Neo4j Graph MCP tool
│   │
│   ├── providers/
│   │   ├── __init__.py
│   │   ├── zai_provider.py            # Z.AI GLM-5.2/4.6 API client
│   │   └── gemini_provider.py         # Google Gemini 1.5 Flash/Pro client
│   │
│   ├── ingestion/
│   │   ├── __init__.py
│   │   ├── rss_processor.py           # RSS/GDELT continuous feed parser
│   │   ├── commodity_etl.py           # Hourly commodity price ETL + Z-score
│   │   ├── satellite_feed.py          # AIS/Copernicus satellite handler
│   │   └── sqs_consumer.py            # SQS queue consumer → Supervisor
│   │
│   ├── database/
│   │   ├── __init__.py
│   │   ├── postgres.py                # PostgreSQL/PostGIS async pool
│   │   ├── dynamodb.py                # DynamoDB session/checkpoint store
│   │   ├── neo4j_db.py                # Neo4j AuraDB driver
│   │   └── shadow_db.py               # Shadow DB for What-If isolation
│   │
│   └── websocket/
│       ├── __init__.py
│       ├── manager.py                 # WebSocket connection pool manager
│       └── handlers.py                # Real-time event stream handlers
│
├── lambdas/
│   ├── rss_ingest/
│   │   ├── index.py                   # RSS Lambda handler
│   │   └── requirements.txt
│   ├── commodity_etl/
│   │   ├── index.py                   # Commodity ETL Lambda handler
│   │   └── requirements.txt
│   └── satellite_ingest/
│       ├── index.py                   # Satellite feed Lambda handler
│       └── requirements.txt
│
├── ui/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tsconfig.app.json
│   ├── tsconfig.node.json
│   │
│   ├── public/
│   │   └── favicon.svg
│   │
│   └── src/
│       ├── main.tsx                   # React entry point
│       ├── App.tsx                    # Root app with dynamic layout engine
│       ├── index.css                  # Global design system (dark glassmorphism)
│       │
│       ├── components/
│       │   ├── layout/
│       │   │   ├── AppShell.tsx        # Main shell with sidebar + header
│       │   │   ├── Sidebar.tsx         # Navigation sidebar
│       │   │   └── Header.tsx          # Top bar with alerts & status
│       │   │
│       │   ├── twin/
│       │   │   ├── SankeyFlow.tsx      # D3.js Sankey supply chain topology
│       │   │   ├── FlowNode.tsx        # Individual topology node
│       │   │   └── FlowLink.tsx        # Flow link with animated band
│       │   │
│       │   ├── war-room/
│       │   │   ├── ParameterSliders.tsx # Transit/Capacity/Cost sliders
│       │   │   ├── ScenarioPanel.tsx   # Scenario injection panel
│       │   │   └── WhatIfControls.tsx  # What-If execution controls
│       │   │
│       │   ├── trace/
│       │   │   ├── AgentTraceOverlay.tsx # Agent cognitive overlay panel
│       │   │   ├── DebateTimeline.tsx   # Geo↔Logistics debate timeline
│       │   │   └── CognitiveStream.tsx  # Live token stream viewer
│       │   │
│       │   ├── finance/
│       │   │   ├── WaterfallChart.tsx   # Financial impact waterfall (D3)
│       │   │   ├── ImpactCards.tsx      # KPI impact summary cards
│       │   │   └── KPIMetrics.tsx       # Live metric counters
│       │   │
│       │   └── common/
│       │       ├── GlassCard.tsx        # Glassmorphism card component
│       │       ├── StatusBadge.tsx      # Agent status indicator
│       │       └── AnimatedCounter.tsx  # Animated number display
│       │
│       ├── hooks/
│       │   ├── useWebSocket.ts         # WebSocket connection hook
│       │   ├── useAgentStream.ts       # Agent real-time stream hook
│       │   └── useDynamicLayout.ts     # Dynamic layout interpretation hook
│       │
│       ├── services/
│       │   ├── api.ts                  # REST API service layer
│       │   ├── websocket.ts            # WebSocket client service
│       │   └── layoutEngine.ts         # JSON→Component layout mapper
│       │
│       ├── stores/
│       │   ├── agentStore.ts           # Agent state management (Zustand)
│       │   ├── scenarioStore.ts        # What-If scenario state
│       │   └── telemetryStore.ts       # Live telemetry data store
│       │
│       └── types/
│           ├── agent.ts                # Agent type definitions
│           ├── scenario.ts             # Scenario/What-If types
│           └── layout.ts               # Dynamic layout schema types
│
└── docs/
    └── architecture.md                 # Full v8.0 architecture spec
```

**Total: ~90 files across 30+ directories**

---

## Proposed Changes

### Root Configuration
- **[NEW] README.md** — Project overview, setup instructions, architecture summary
- **[NEW] .env.example** — Template for all API keys & connection strings (Z.AI, Gemini, AWS, Neo4j, Firecrawl, Scrape.do)
- **[NEW] .gitignore** — Python, Node, Terraform, IDE ignores
- **[NEW] mcp.json** — MCP server manifest from spec §7
- **[NEW] docker-compose.yml** — Local PostgreSQL+PostGIS, Neo4j containers
- **[NEW] pyproject.toml** — Python project metadata

---

### Infrastructure (Terraform + SQL)
- **[NEW] infrastructure/terraform/main.tf** — Full IaC from spec §10 (SQS FIFO, DynamoDB, RDS, Lambda, EventBridge)
- **[NEW] infrastructure/terraform/variables.tf** — Parameterized variables for region, instance class, etc.
- **[NEW] infrastructure/terraform/outputs.tf** — Exported ARNs and endpoints
- **[NEW] infrastructure/terraform/terraform.tfvars.example** — Defaults template
- **[NEW] infrastructure/sql/init_postgis.sql** — Schema from spec §11 (PostGIS, commodity_price_ticks, spatial_risk_events)

---

### Backend (Python/LangGraph)
All agent implementations follow the spec §4 model registry bindings and tool permissions.

- **Models**: LangGraph `SwarmState` TypedDict matching the spec §4 state schema, plus Pydantic request/response models
- **Agents**: 8 agent modules each with their designated LLM provider and tool permissions
- **Graph**: LangGraph StateGraph builder with conditional routing and adversarial debate loop (N_max=3)
- **Tools**: 5 MCP tool client wrappers
- **Providers**: Z.AI and Gemini HTTP API client wrappers
- **Ingestion**: RSS, commodity, and satellite feed processors + SQS consumer
- **Database**: Async connection managers for PostgreSQL, DynamoDB, Neo4j, and Shadow DB
- **WebSocket**: Connection pool manager + real-time event handlers

---

### Lambda Functions
- **rss_ingest** — 5-minute cron RSS/GDELT processor → SQS
- **commodity_etl** — Hourly commodity price ETL with Z-score anomaly detection
- **satellite_ingest** — AIS/Satellite feed normalization → SQS

---

### Frontend (React/Vite/D3.js)
Premium dark glassmorphism UI with:
- **Digital Twin Canvas** — D3.js Sankey flow topology showing material volumes and bottlenecks
- **War Room** — Parameter sliders for synthetic scenario injection
- **Agent Traces** — Glass-box overlay showing live agent debate streams
- **Financial Impact** — Waterfall charts and KPI impact cards
- **Dynamic Layout Engine** — Parses Supervisor JSON payloads to mount/unmount components at runtime

---

### Documentation
- **[NEW] docs/architecture.md** — Full v8.0 specification document

---

## Verification Plan

### Automated Tests
- Backend: `cd backend && python -m pytest` (after dependencies installed)
- Frontend: `cd ui && npm run build` to verify TypeScript compilation

### Manual Verification
- Verify all 90+ files are created in correct locations
- Verify import chains are consistent across Python packages
- Verify TypeScript types align with backend schemas
