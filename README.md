# Jarvis-Style Supply Chain Intelligence Platform

Real-time operational intelligence system that monitors global events and maps
their impact onto a supply-chain graph, visualized through a Jarvis-style HUD
over an interactive world map. Full product/architecture spec: [docs/PRD.md](docs/PRD.md).

This repository is currently a **skeleton**: it lays out the event-driven
architecture described in the PRD (Redis Streams blackboard, dynamically
activated agents, config-driven ETL). Intel (live NewsAPI search), the News
ETL (GDELT live search, optional NewsAPI enrichment, and per-article geocoding),
and Supervisor (DuckDuckGo web search + Nominatim geocoding + OpenRouter LLM
synthesis, merging its siblings' findings into one action-oriented answer)
have real implementations. Spatial,
Vision, Logistics, and Commodity are still stubs -- each `handle()`/`main()`
is a `TODO`.

Only the stateful data services (Redis, PostgreSQL/PostGIS, Neo4j) run in
Docker. The gateway, agents, ETL workers, and frontend are run natively on
the host, so they don't have Dockerfiles right now -- except
`agents/spatial/Dockerfile`, kept as a documented fallback since its C++
dependencies (hiredis/yaml-cpp/nlohmann-json) are painful to install natively
on Windows.

## Layout

```
backend/        FastAPI gateway: WebSocket session, query router, Redis Streams bridge
agents/
  common/       Shared Python agent base class + Redis Streams client
  intel/        News/RSS/risk summarization (stub)
  spatial/      C++ geofencing / spatial overlap agent (stub)
  vision/       Satellite/weather imagery agent (stub)
  logistics/    Neo4j graph traversal / route agent (stub)
  commodity/    Commodity price/volatility agent (stub)
  supervisor/   Waits for sibling agents' results, merges + web-searches +
                asks the LLM for one final answer (PRD's Narrative Agent role)
etl/            Celery Beat + workers for the four ambient ETL pipelines
frontend/       React + TypeScript + MapLibre GL + deck.gl + Tailwind + Zustand
databases/      Postgres/PostGIS schema and Neo4j constraints
config/settings.yaml   Central, hot-editable config: ETL schedules, risk
                        thresholds, query-router intent map, agent priorities,
                        map layers -- see PRD section 12 (no hardcoded values)
requirements-dev.txt    Union of every Python service's deps, for one shared venv
```

## Running locally

### 1. Start the data services

```
docker compose up -d
```

Brings up Redis (`localhost:6379`), PostgreSQL/PostGIS (`localhost:5432`),
and Neo4j (`localhost:7687`, browser at `localhost:7474`). Every native
service already defaults to these localhost addresses with the same
`change-me` password used in `docker-compose.yml`, so **no `.env` file is
required** for plain local dev -- see `.env.example` if you need to override
something (real API keys, a different password, etc).

For Supervisor LLM synthesis, copy `.env.example` to `.env` and set
`OPENROUTER_API_KEY`. The default `OPENROUTER_MODEL=nex-agi/nex-n2-mini` is a
very low-cost paid model; you can switch to a `:free` OpenRouter model if you
prefer zero token cost over steadier availability. Keep `.env` local; don't
commit or paste keys into chat/logs.

One-time: load the Neo4j graph constraints, then the demo/seed data (a small
plausible supply-chain network -- suppliers/factories/warehouses/ports plus
shipping lanes and risk geofences -- so the map has something to render) —

```
docker compose exec neo4j cypher-shell -u neo4j -p change-me -f /init/constraints.cypher
docker compose exec neo4j cypher-shell -u neo4j -p change-me -f /init/seed.cypher
cat databases/postgis/seed.sql | docker compose exec -T postgres psql -U supply_chain -d supply_chain
```

### 2. Python services (backend, agents, ETL)

One shared virtualenv is simplest since the services share most of their
dependencies:

```
python -m venv .venv
.venv\Scripts\activate        # PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
```

Then, each in its own terminal (all commands run from the repo root):

```
# Gateway
# run.py (not the bare `uvicorn` CLI) is required on Windows: it sets the
# selector event loop policy before uvicorn creates its loop, which psycopg's
# async mode needs -- setting it inside app/main.py runs too late, since the
# `uvicorn` CLI already creates a (Proactor) loop via asyncio.run() before it
# imports the app module.
cd backend; python run.py

# Agents (repeat per agent: intel, vision, logistics, commodity, supervisor)
python agents/intel/main.py

# ETL (needs both a worker and a beat scheduler)
# --pool=solo is required on Windows: Celery's default "prefork" pool needs
# fork(), which Windows doesn't support, and fails with a billiard/pool.py
# "not enough values to unpack" error without this flag.
cd etl; celery -A celery_app worker --pool=solo --loglevel=info
cd etl; celery -A celery_app beat --loglevel=info
```

The Spatial Agent is C++ (`agents/spatial/`) and needs hiredis, yaml-cpp, and
nlohmann-json available to build with CMake -- see `agents/spatial/Dockerfile`
for the exact packages if you want to build it natively; it's the one service
where using Docker directly (`docker build -f agents/spatial/Dockerfile .`) is
likely easier than installing those libraries on Windows.

### 3. Frontend

```
cd frontend
npm install
copy .env.example .env
npm run dev
```

Opens at `http://localhost:5173`. Uses CARTO's Dark Matter style for map
tiles (via MapLibre GL, not Mapbox GL) -- free, no API key required.
Override `VITE_MAP_STYLE_URL` in `frontend/.env` if you want a different style
(e.g. [OpenFreeMap](https://openfreemap.org)'s liberty/bright/positron, also
free/no-key) or self-hosted tiles.

## Architecture in one paragraph

The frontend opens a single WebSocket to the FastAPI gateway. Submitting a
query resolves an intent via `config/settings.yaml`'s `query_router.intents`
map, which decides which agents to activate, and publishes onto the
`query.received` Redis Stream. Every worker agent (Intel, Spatial, Vision,
Logistics, Commodity) independently consumes that stream through its own
consumer group, acts only on queries addressed to it, and publishes its
result onto its own output stream (`news.ingested`, `weather.updated`,
`satellite.ready`, `route.recomputed`, `risk.detected`, `commodity.updated`)
without waiting on any other agent. Supervisor is the one exception: it also
consumes `query.received`, but then *observes* (doesn't compete for) its
siblings' output streams for that session_id, up to a bounded timeout, merges
whatever it collected with its own live web search, resolves a map location,
and asks the LLM for one final answer on `explanation.updated`. The gateway
forwards any of those messages matching the requesting session straight to
the browser as soon as they land. Separately, Celery Beat drives four ambient
ETL pipelines (news/weather/commodity/satellite) on config-driven schedules
that keep Neo4j/PostGIS populated and push ambient (non-session) updates onto
the same streams -- the News ETL also geocodes a few articles per cycle so
the frontend can plot a live global feed.

## Next steps

- Implement real fetch/parse logic in the weather/commodity/satellite ETL
  tasks (`etl/tasks/*.py`) -- only news is real so far.
- Implement Spatial/Vision/Logistics/Commodity's `handle()` against the
  Knowledge Layer (Neo4j/PostGIS) instead of returning stub payloads --
  once they do, Supervisor's `_resolve_location` will prefer their precise
  geometry over its own text-geocoding fallback.
- Add authentication to the FastAPI gateway (PRD section 7 lists it as a
  gateway responsibility; not yet implemented).
