-- KPI schema: order/inventory event facts + computed KPI values.
-- PostgreSQL is the source of truth for all KPI data -- Neo4j only ever
-- receives a write-through summary of the latest values (see
-- backend/app/services/kpi/repository.py). No supplier/warehouse/SKU
-- identifiers are seeded here -- rows are created at runtime by the
-- /webhooks/* endpoints in backend/app/api/kpi_router.py.

CREATE TABLE IF NOT EXISTS kpi_facts (
    id            BIGSERIAL PRIMARY KEY,
    entity_id     TEXT NOT NULL,
    entity_type   TEXT NOT NULL,     -- warehouse | supplier | factory | route
    kpi_name      TEXT NOT NULL,
    kpi_value     NUMERIC NOT NULL,
    period_start  TIMESTAMPTZ NOT NULL,
    period_end    TIMESTAMPTZ NOT NULL,
    computed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Entity lookups (e.g. "all KPIs for warehouse-11").
CREATE INDEX IF NOT EXISTS idx_kpi_facts_entity ON kpi_facts (entity_type, entity_id);
-- KPI filtering across entities (e.g. "every fill_rate row").
CREATE INDEX IF NOT EXISTS idx_kpi_facts_name ON kpi_facts (kpi_name);
-- Time-series queries: latest/trend for one entity+kpi.
CREATE INDEX IF NOT EXISTS idx_kpi_facts_timeseries
    ON kpi_facts (kpi_name, entity_id, computed_at DESC);

CREATE TABLE IF NOT EXISTS inventory_snapshots (
    snapshot_id         BIGSERIAL PRIMARY KEY,
    warehouse_id        TEXT NOT NULL,
    sku_id              TEXT NOT NULL,
    inventory_count     INTEGER NOT NULL,
    inventory_value     NUMERIC NOT NULL,
    inventory_accuracy  NUMERIC,
    snapshot_timestamp  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_snapshots_warehouse_time
    ON inventory_snapshots (warehouse_id, snapshot_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_snapshots_sku ON inventory_snapshots (sku_id);

CREATE TABLE IF NOT EXISTS order_events (
    order_id          TEXT PRIMARY KEY,
    supplier_id       TEXT,
    warehouse_id      TEXT,
    route_id          TEXT,
    order_created_at  TIMESTAMPTZ NOT NULL,
    packed_at         TIMESTAMPTZ,
    shipped_at        TIMESTAMPTZ,
    delivered_at      TIMESTAMPTZ,
    returned_at       TIMESTAMPTZ,
    damaged_flag      BOOLEAN NOT NULL DEFAULT false,
    picked_correctly  BOOLEAN,
    on_time_flag      BOOLEAN,
    backordered_flag  BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_order_events_warehouse ON order_events (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_order_events_supplier ON order_events (supplier_id);
CREATE INDEX IF NOT EXISTS idx_order_events_route ON order_events (route_id);
CREATE INDEX IF NOT EXISTS idx_order_events_created_at ON order_events (order_created_at DESC);

-- Materialized views for the three heaviest aggregate KPIs. Refreshed
-- on-demand by services/kpi/repository.py.refresh_materialized_views()
-- immediately after a webhook write -- there is no scheduler (Celery Beat
-- is explicitly out of scope); recomputation is request-triggered.
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_fill_rate AS
    SELECT
        warehouse_id AS entity_id,
        'warehouse'  AS entity_type,
        date_trunc('day', order_created_at) AS period,
        count(*) FILTER (WHERE shipped_at IS NOT NULL)::numeric
            / NULLIF(count(*), 0) AS fill_rate
    FROM order_events
    WHERE warehouse_id IS NOT NULL
    GROUP BY warehouse_id, date_trunc('day', order_created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_fill_rate ON mv_fill_rate (entity_id, period);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_perfect_order_rate AS
    SELECT
        route_id    AS entity_id,
        'route'     AS entity_type,
        date_trunc('day', order_created_at) AS period,
        avg(
            CASE
                WHEN on_time_flag IS TRUE
                     AND damaged_flag IS FALSE
                     AND picked_correctly IS TRUE
                     AND delivered_at IS NOT NULL
                THEN 1.0 ELSE 0.0
            END
        ) AS perfect_order_rate
    FROM order_events
    WHERE route_id IS NOT NULL
    GROUP BY route_id, date_trunc('day', order_created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_perfect_order_rate
    ON mv_perfect_order_rate (entity_id, period);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_order_cycle_time AS
    SELECT
        route_id    AS entity_id,
        'route'     AS entity_type,
        date_trunc('day', order_created_at) AS period,
        avg(EXTRACT(EPOCH FROM (delivered_at - order_created_at)) / 3600.0) AS avg_cycle_hours
    FROM order_events
    WHERE route_id IS NOT NULL AND delivered_at IS NOT NULL
    GROUP BY route_id, date_trunc('day', order_created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_order_cycle_time
    ON mv_order_cycle_time (entity_id, period);
