# 🧠 Multi-Agent Supply Chain Risk Intelligence System

**v8.0 — Cognitive Control Tower**

A hybrid cloud-edge event swarm platform that transitions corporate supply chain risk response from reactive shock mitigation to proactive structural adjustment. Built on LangGraph orchestration with Z.AI GLM-5.2 and Google Gemini multimodal reasoning.

---

## Architecture Overview

```
[ Multi-Modal Feeds ]  →  [ Ingestion Buffer ]  →  [ Multi-Agent Swarm ]  →  [ Digital Twin Canvas ]
      (RSS/AIS/Sat)          (SQS + Lambda)         (LangGraph + MCP)         (React + D3.js)
```

### Agent Roster

| Agent | Model | Role |
|-------|-------|------|
| 🧠 Supervisor | Z.AI GLM-5.2 | Orchestrates swarm routing & UI layout dispatch |
| 🕵️ Intelligence | Gemini 1.5 Flash | NER extraction from news & telemetry |
| 👁️ Vision | Gemini 1.5 Pro | Satellite imagery analysis & port congestion |
| 🗺️ Spatial | Gemini 1.5 Flash | GeoJSON resolution & route overlap detection |
| 🌍 Geopolitical | Gemini 1.5 Flash | Regional stability monitoring |
| 🚢 Logistics | Z.AI GLM-5.2 | Route tracing & harbor capacity modeling |
| 💰 Finance | Z.AI GLM-4.6 | Working capital & margin impact analysis |
| ⚖️ Synthesis | Z.AI GLM-5.2 | Adversarial critic with retry cap (N_max=3) |

### MCP Tool Integrations

- **Firecrawl MCP** — Web-to-markdown extraction
- **Scrape.do MCP** — Anti-bot proxy bypass
- **C++ Spatial Engine MCP** — Winding number point-in-polygon
- **SQL Analytics MCP** — PostgreSQL/PostGIS queries
- **Neo4j Graph MCP** — Topology traversal

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.11+, FastAPI, LangGraph |
| Frontend | React 18, TypeScript, Vite, D3.js |
| LLMs | Z.AI GLM-5.2/4.6, Google Gemini 1.5 Flash/Pro |
| Databases | PostgreSQL + PostGIS, DynamoDB, Neo4j AuraDB |
| Infrastructure | AWS (Lambda, SQS, RDS, EventBridge), Terraform |
| Real-time | WebSocket (FastAPI native) |

---

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- Docker & Docker Compose
- AWS CLI (for deployment)
- Terraform (for infrastructure)

### 1. Clone & Configure

```bash
git clone <repository-url>
cd new_supply_chain
cp .env.example .env
# Fill in API keys in .env
```

### 2. Start Local Infrastructure

```bash
docker-compose up -d
```

### 3. Initialize Database

```bash
psql -h localhost -U db_orchestrator -d risk_intelligence -f infrastructure/sql/init_postgis.sql
```

### 4. Start Backend

Run this command from the project root directory (`new_supply_chain`):

```bash
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000
```

### 5. Start Frontend

```bash
cd ui
npm install
npm run dev
```

### 6. Deploy AWS Infrastructure (Optional)

```bash
cd infrastructure/terraform
terraform init
terraform plan
terraform apply
```

---

## Project Structure

```
new_supply_chain/
├── backend/          # Python/LangGraph multi-agent swarm
│   ├── agents/       # 8 specialized agent modules
│   ├── graph/        # LangGraph state graph & routing
│   ├── tools/        # MCP tool client wrappers
│   ├── providers/    # LLM API clients (Z.AI, Gemini)
│   ├── ingestion/    # Feed processors (RSS, commodity, satellite)
│   ├── database/     # DB connectors (Postgres, DynamoDB, Neo4j)
│   └── websocket/    # Real-time communication layer
├── ui/               # React/Vite/D3.js frontend
│   └── src/
│       ├── components/  # UI component library
│       ├── hooks/       # React hooks
│       ├── services/    # API & WebSocket services
│       ├── stores/      # Zustand state stores
│       └── types/       # TypeScript type definitions
├── lambdas/          # AWS Lambda function handlers
├── infrastructure/   # Terraform IaC & SQL schemas
└── docs/             # Architecture documentation
```

---

## License

Proprietary — Internal Use Only
