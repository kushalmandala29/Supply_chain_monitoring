# Jarvis Supply Chain Intelligence Platform

Real-time operational intelligence system that monitors global events, tracks
live supply-chain KPIs, and maps their combined impact onto a knowledge graph
-- visualized through a Jarvis-style command center: a sidebar-navigated
dashboard with a live 2D map, KPI views, alerts, and an AI intelligence panel.
Full product/architecture spec: [docs/PRD.md](docs/PRD.md).

## What this platform does

- **Ask natural-language questions** ("What's the fill rate in Southeast
  Asia?", "Which suppliers have the worst cycle time?", "Port congestion near
  Rotterdam?") and get an answer synthesized from live news, geocoding, the
  supply-chain graph, and real KPI data -- not a canned response.
- **Track 10 supply-chain KPIs** end-to-end: Inventory Turnover, Inventory
  Accuracy, Days on Hand, Rate of Return, Backorder Rate, Order Fill Rate,
  Perfect Order Rate, On-Time Shipping, Order Cycle Time, and Order Picking
  Accuracy -- computed from real order/inventory events, thresholded entirely
  from config (nothing hardcoded), and pushed to every connected client the
  moment they change.
- **Command-center UI** (React Router + MapLibre GL + deck.gl): a collapsible
  sidebar (Command Center, Live Map, KPI Dashboard, Intelligence Feed, Alerts,
  Investigations, ...) and a live 2D map where every clickable layer --
  facilities, shipping routes, risk geofences, KPI alerts, and an ambient
  live news-pin feed that updates independently of any query -- routes
  through the exact same select-fly-ask pipeline the search bar uses, so
  clicking a risk zone gets the same live, animated response as typing a
  question about it.
- **Auto-surfaced intel, not click-to-reveal**: when the Vision Agent
  resolves a real NASA GIBS satellite image for a query's location, it pops
  up automatically (no click needed) while the map flies there with the same
  motion; answers render as short, scannable highlights instead of long
  paragraphs.

## Architecture

![Architecture diagram](docs/assets/architecture.png)

<details>
<summary>Mermaid source (renders inline on GitHub/GitLab; edit this to regenerate the PNG above)</summary>

```mermaid
flowchart TB
    subgraph Client["Frontend (React + Zustand + MapLibre GL/deck.gl)"]
        UI["Sidebar + Topbar search /\nIntelligence Panel / Live Map / KPI Dashboard"]
    end

    subgraph Gateway["FastAPI Gateway"]
        WS["WebSocket /ws\n(query in, every stream out)"]
        REST["REST: /map/network, /kpi/*,\n/webhooks/orders/*, /webhooks/inventory/*"]
    end

    subgraph Bus["Redis Streams (shared blackboard)"]
        QSUB["query.submitted"]
        QREC["query.received"]
        RESULTS["news.ingested / weather.updated / commodity.updated\nsatellite.ready / route.recomputed / risk.detected\nexplanation.updated / map.updated"]
        KPI_STREAMS["kpi.update / kpi.alert"]
    end

    subgraph Agents["Agents (each its own consumer group)"]
        ROUTER["Router\n(LLM-based intent -> agent list)"]
        MAPPER["Mapper\n(news/explanations -> map geometry)"]
        INTEL["Intel\nnews -> graph -> KPI impact"]
        SPATIAL["Spatial (C++)\nreal weather + KPI, placeholder geography\n-> weighted compounded risk"]
        VISION["Vision\ngeocodes query -> NASA GIBS imagery"]
        LOGISTICS["Logistics\nranked KPI queries + graph context"]
        COMMODITY["Commodity\nprice volatility <-> inventory KPIs"]
        SYNTHESIS["Synthesizer\nmerges siblings + web search +\nnearby KPIs -> LLM streaming synthesis"]
    end

    subgraph KpiPipeline["services/kpi (backend)"]
        CALC["calculator.py\ninventory_metrics.py / logistics_metrics.py"]
        THRESH["threshold_engine.py\n(reads config/settings.yaml)"]
        REPO["repository.py\n(Postgres read/write + Neo4j sync)"]
        PUB["websocket_publisher.py"]
    end

    subgraph Data["Data layer"]
        PG[("PostgreSQL + PostGIS\nsource of truth:\nkpi_facts, order_events,\ninventory_snapshots, shipping_lanes")]
        NEO[("Neo4j\nrelationship summaries only:\nSupplier/Factory/Warehouse/Port\n+ KPI properties, write-through")]
    end

    UI <--> |WebSocket| WS
    UI --> |on mount / hover| REST
    WS --> QSUB
    QSUB --> ROUTER
    ROUTER --> QREC
    QREC --> INTEL & SPATIAL & VISION & LOGISTICS & COMMODITY & SYNTHESIS & MAPPER
    INTEL & SPATIAL & VISION & LOGISTICS & COMMODITY & MAPPER --> RESULTS
    SYNTHESIS -. observes sibling streams .-> RESULTS
    SYNTHESIS --> RESULTS
    RESULTS --> WS

    REST --> CALC
    CALC --> THRESH
    CALC --> REPO
    REPO --> PG
    REPO --> |write-through, never read back| NEO
    REPO --> PUB --> KPI_STREAMS --> WS

    LOGISTICS --> PG
    LOGISTICS --> NEO
    COMMODITY --> PG
    INTEL --> NEO
    INTEL --> PG
    SYNTHESIS --> PG
    SYNTHESIS --> NEO
    SPATIAL -. XREVRANGE .-> KPI_STREAMS
```

</details>

**Principles enforced throughout:** PostgreSQL is always the source of truth;
Neo4j only ever receives a write-through summary and is never read to derive
a KPI value; every threshold lives in `config/settings.yaml`, never in code;
agents only communicate through Redis Streams, never by calling each other
directly.

## Layout

```
backend/
  app/
    api/            FastAPI routes: websocket, map_router, kpi_router (webhooks + reads)
    core/            Config loader, Postgres/Neo4j clients, Redis StreamBus
    models/          Pydantic schemas (query.py, kpi.py)
    services/kpi/     calculator, inventory_metrics, logistics_metrics,
                      threshold_engine, repository (Postgres + Neo4j sync),
                      websocket_publisher
  tests/            pytest for the KPI formulas + threshold engine
agents/
  common/           Shared BaseAgent, Redis StreamBus, Postgres client, config loader
  router/           LLM-based intent classification and agent selection
  mapper/           Listens to outputs and geocodes entities into map pins
  intel/            News search + geocoding + nearby-facility KPI impact
  spatial/          C++: KPI + real-weather-weighted compounded operational risk
                      (geofencing/ST_* geometry still TODO)
  vision/           Geocodes a query, returns NASA GIBS satellite imagery tiles
  logistics/        KPI-aware: ranked Postgres queries joined with Neo4j graph context
  commodity/         Commodity price volatility <-> inventory KPI correlation
  synthesizer/      Merges siblings + web search + nearby KPIs, asks the LLM
                      for one final streaming answer (PRD's Narrative Agent role)
etl/                Celery Beat + workers for ambient news/weather/commodity/satellite ingestion
frontend/
  src/components/layout/       AppShell, Sidebar, Topbar -- the persistent
                                nav/search shell wrapping every routed view
  src/components/map/          MapCanvas (MapLibre GL + deck.gl, controlled
                                view state so flyTo animations aren't undone
                                by re-renders) and its layers/: facilities,
                                routes, risk geofences, KPI alerts, ambient
                                live news pins, commodity heatmap (off by
                                default, still mock data) -- the four
                                real-data layers are all clickable and each
                                triggers the same live query the search bar
                                would
  src/components/intelligence/ IntelligencePanel -- context-sensitive right
                                panel (AI answer, or the selected entity)
  src/components/HUD/          HudPanel, AgentConsole, ExplanationPanel, InfoPopup, SourceCard
  src/components/HUD/kpi/      KpiRing, KpiPanel, AlertPulse, TrendSparkline, GlobalDashboard
  src/views/                   One file per sidebar route (CommandCenterView,
                                LiveMapView, KpiDashboardView, AlertsCenterView,
                                InvestigationsView, IntelligenceFeedView, SettingsView)
  src/store/useStore.ts        Live domain/WS store: trace, network/KPI/map-marker state
  src/store/useWorkspaceStore.ts Nav/UI store: sidebar, selected entity, favorites,
                                pinned entities, search history, investigations
                                (persisted to localStorage)
databases/
  postgres/         init.sql (sessions/alerts/commodity_history) + kpi.sql (KPI schema)
  postgis/          Geofences/shipping lanes schema + seed data
  neo4j/            constraints.cypher, seed.cypher, kpi_properties.cypher
config/settings.yaml  Central, hot-editable config: ETL schedules, risk
                      thresholds, query-router intents, agent priorities,
                      map layers, and the `kpi:` section (thresholds/
                      direction/interval/alert per KPI) -- no hardcoded values
requirements-dev.txt  Union of every Python service's deps, for one shared venv
```

## Running locally

### 1. Start the data services

```
docker compose up -d
```

Brings up Redis (`localhost:6379`), PostgreSQL/PostGIS (`localhost:5432`),
and Neo4j (`localhost:7687`, browser at `localhost:7474`). On a fresh clone
with no `.env` file, every native service and `docker-compose.yml` both
default to the same `change-me` password, so nothing needs configuring. If a
`.env` already exists in this checkout (see `.env.example` for the full list
of overridable values), its `NEO4J_PASSWORD`/`POSTGRES_PASSWORD` are what the
containers were actually created with -- docker compose auto-loads `.env`,
so those values win over `docker-compose.yml`'s fallback defaults.

For Synthesizer LLM synthesis and Router agent logic, copy `.env.example` to `.env` and set
`OPENROUTER_API_KEY`. The default `OPENROUTER_MODEL=meta-llama/llama-3.1-8b-instruct` is a
very fast open model; you can switch to a `:free` OpenRouter model if you
prefer zero token cost over steadier availability. Keep `.env` local; don't
commit or paste keys into chat/logs.

One-time: load the Neo4j graph constraints, then the demo/seed data (a small
plausible supply-chain network -- suppliers/factories/warehouses/ports plus
shipping lanes and risk geofences -- so the map has something to render) —

```
docker compose exec neo4j cypher-shell -u neo4j -p <NEO4J_PASSWORD> -f /init/constraints.cypher
docker compose exec neo4j cypher-shell -u neo4j -p <NEO4J_PASSWORD> -f /init/seed.cypher
docker compose exec neo4j cypher-shell -u neo4j -p <NEO4J_PASSWORD> -f /init/kpi_properties.cypher
cat databases/postgis/seed.sql | docker compose exec -T postgres psql -U supply_chain -d supply_chain
```

Replace `<NEO4J_PASSWORD>` with whatever `NEO4J_PASSWORD` is set to in your
`.env` (docker compose auto-loads `.env` for the values in
`docker-compose.yml`, so the container's real password is whatever was in
`.env` *the first time the `neo4j_data` volume was created* -- `change-me`
only applies if you had no `.env` yet at that point). If you get "client is
unauthorized due to authentication failure," check `.env`'s `NEO4J_PASSWORD`
first before assuming something else is wrong.

The Postgres KPI tables (`kpi_facts`, `inventory_snapshots`, `order_events`) load
automatically from `databases/postgres/kpi.sql` on first container init (see
`docker-compose.yml`). If your `postgres_data` volume already existed before
this file was added, apply it manually instead:

```
cat databases/postgres/kpi.sql | docker compose exec -T postgres psql -U supply_chain -d supply_chain
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

# Agents (repeat per agent: router, mapper, intel, vision, logistics, commodity, synthesizer)
python agents/router/main.py
python agents/mapper/main.py
python agents/synthesizer/main.py
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

Opens at `http://localhost:5173`. The map uses OpenFreeMap's free, keyless
`dark` style by default (no API key, no rate limits); override
`VITE_MAP_STYLE_URL` in `frontend/.env` to point at a different MapLibre style
(e.g. a self-hosted PMTiles deployment).

Note: `<React.StrictMode>` is intentionally not enabled in `src/main.tsx` --
its dev-only double-invoke of mount/cleanup effects breaks `maplibre-gl`'s
initialization (the map never leaves a blank canvas). This only affects `npm
run dev`; production builds are unaffected since React only double-invokes in
development.

## KPI Intelligence Pipeline

Order/inventory events enter the platform exclusively through five webhooks
(no ERP/WMS/OMS integration, no scheduler -- everything is request-triggered
and real-time):

| Endpoint | Effect |
|---|---|
| `POST /webhooks/orders/shipped` | Upserts `order_events`, recomputes `fill_rate` |
| `POST /webhooks/orders/delivered` | Recomputes `perfect_order_rate`, `order_cycle_time`, `on_time_shipping`, `picking_accuracy` |
| `POST /webhooks/orders/returned` | Recomputes `return_rate` |
| `POST /webhooks/orders/damaged` | Recomputes `perfect_order_rate` |
| `POST /webhooks/inventory/update` | Recomputes `inventory_accuracy`, `inventory_turnover`, `days_on_hand` |

Every recompute: (1) writes the new value to `kpi_facts` (Postgres, source of
truth), (2) write-through syncs the same value onto the corresponding Neo4j
node/relationship, (3) classifies it green/amber/red via
`config/settings.yaml`'s `kpi:` section, and (4) publishes it on `kpi.update`
(always) and `kpi.alert` (only if the configured threshold was breached) --
both forwarded to every connected browser over the existing WebSocket, the
same way ambient ETL updates already were.

Reads: `GET /kpi/network` (snapshot for the globe/HUD on load), `GET
/kpi/history` (sparklines), `GET /kpi/dashboard` (platform-wide rollup), `GET
/config/kpi-thresholds` (lets the frontend display real thresholds instead of
hardcoding them).

## Next steps

- Weather (Open-Meteo) and satellite (NASA GIBS) ETL are now real and
  keyless; `commodity` ETL is still a stub (needs a market-data source
  decision). The Spatial Agent's `weather` risk component now reads real
  per-entity risk from `weather.updated`; its `geography` component is still
  a neutral placeholder pending real PostGIS `ST_*` geometry work.
- Reconcile `shipping_lanes` (PostGIS, numeric id) with the `route_id` text
  identifier used by `order_events`/`kpi_facts`/Neo4j's `CONNECTS_TO`
  relationship -- they're different id spaces today, so route KPI overlays
  fall back to healthy/delayed/blocked status color until a shared key exists.
- Add authentication to the FastAPI gateway (PRD section 7 lists it as a
  gateway responsibility; not yet implemented).
- Frontend command-center redesign: layout shell, the live map (facility/
  route/geofence/alert click parity + ambient news layer), KPI Dashboard,
  Alerts Center, and Intelligence Feed (satellite imagery/weather/risk
  rendered as real cards, not raw JSON) are all live. Still open: marker
  clustering at low zoom; full per-entity-type Intelligence Panel detail
  (KPI history/news per facility|route|geofence, beyond the current basic
  card); Investigation Workspace beyond create/list (pinning, comparisons,
  event replay); search autocomplete; optional backend-inclusive work
  (persisted/paginated alert & news history, time-playback, `/graph/related/:id`).
