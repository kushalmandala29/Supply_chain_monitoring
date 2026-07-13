-- PostgreSQL schema: sessions, logs, historical alerts, commodity history.
-- No supplier/country/commodity names are seeded here -- all such data is
-- discovered at runtime via the ETL pipelines and stored as rows, never as
-- schema.

CREATE TABLE IF NOT EXISTS sessions (
    session_id      UUID PRIMARY KEY,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS query_log (
    id              BIGSERIAL PRIMARY KEY,
    session_id      UUID REFERENCES sessions (session_id),
    query_text      TEXT NOT NULL,
    intent          TEXT,
    agents          TEXT[] NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS alerts (
    id              BIGSERIAL PRIMARY KEY,
    source_stream   TEXT NOT NULL,
    severity        TEXT NOT NULL,
    entity_type     TEXT,
    entity_id       TEXT,
    payload         JSONB NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS commodity_history (
    id              BIGSERIAL PRIMARY KEY,
    commodity_code  TEXT NOT NULL,
    price           NUMERIC NOT NULL,
    currency        TEXT NOT NULL,
    unit            TEXT NOT NULL,
    source          TEXT NOT NULL,
    recorded_at     TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_query_log_session ON query_log (session_id);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_commodity_history_code_time
    ON commodity_history (commodity_code, recorded_at DESC);
