# Multi-Agent Supply Chain Risk Intelligence System

## Enterprise Architecture Blueprint — v8.0

**Core Pattern:** Hybrid Cloud-Edge Event Swarm (LangGraph + Z.AI + Gemini)  
**Presentation Paradigm:** Composed Interactive Digital Twin Canvas  

---

## System Overview

The v8.0 platform is a **Cognitive Control Tower** engineered to move corporate supply chain 
risk response from reactive shock mitigation to predictive structural insulation.

### Core Mandates

1. **Query Ingestion Decoupling** — Live feeds consumed by serverless workers; frontend reads aggregated state only
2. **Compute-Cost Optimization** — Z-score ≥ 2.5 threshold before LLM spin-up; AWS Free-Tier infrastructure
3. **Dynamic Composable Viewports** — Supervisor dispatches JSON layout specs; UI mounts components at runtime

---

## Agent Roster

| Agent | Model | Responsibilities | Tools |
|-------|-------|-------------------|-------|
| 🧠 Supervisor | Z.AI GLM-5.2 | Orchestration, routing, UI layout dispatch | None |
| 🕵️ Intelligence | Gemini 1.5 Flash | NER extraction, claim isolation | Firecrawl MCP |
| 👁️ Vision | Gemini 1.5 Pro | Satellite imagery, vessel detection | None |
| 🗺️ Spatial | Gemini 1.5 Flash | GeoJSON resolution, route overlaps | C++ Spatial MCP |
| 🌍 Geopolitical | Gemini 1.5 Flash | Regional stability, sanctions monitoring | Firecrawl MCP |
| 🚢 Logistics | Z.AI GLM-5.2 | Route tracing, harbor capacity | Neo4j MCP, Scrape.do MCP |
| 💰 Finance | Z.AI GLM-4.6 | Working capital, margin impact | SQL Analytics MCP |
| ⚖️ Synthesis | Z.AI GLM-5.2 | Adversarial debate, validation, commit | SQL Analytics MCP |

---

## Memory Tiers

1. **Ephemeral** (DynamoDB) — 48h TTL checkpoints and session data
2. **Persistent** (PostgreSQL/PostGIS) — Event history, price ticks, risk assessments
3. **Topology** (Neo4j AuraDB) — Port→Commodity→Factory dependency graph

---

## Deployment Constraints

- WebSocket idle timeout: 2 hours → 10-minute ping loop
- Adversarial debate cap: N_max = 3 iterations
- RDS instance: db.t3.micro (CPU credit-based)
