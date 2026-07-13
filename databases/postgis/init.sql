-- PostGIS schema: geofences, weather polygons, shipping lanes, coordinates.
-- Populated at runtime by the Weather/Satellite/Logistics ETL pipelines and
-- the Spatial Agent -- no coordinates or region names are hardcoded here.

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS geofences (
    id              BIGSERIAL PRIMARY KEY,
    source_stream   TEXT NOT NULL,
    label           TEXT,
    risk_level      TEXT,
    geom            GEOMETRY(Polygon, 4326) NOT NULL,
    valid_from      TIMESTAMPTZ NOT NULL DEFAULT now(),
    valid_until     TIMESTAMPTZ,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS weather_polygons (
    id              BIGSERIAL PRIMARY KEY,
    event_type      TEXT NOT NULL,
    severity        TEXT,
    geom            GEOMETRY(Polygon, 4326) NOT NULL,
    observed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS shipping_lanes (
    id              BIGSERIAL PRIMARY KEY,
    origin_ref      TEXT NOT NULL,
    destination_ref TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'healthy',
    geom            GEOMETRY(LineString, 4326) NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_geofences_geom ON geofences USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_weather_polygons_geom ON weather_polygons USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_shipping_lanes_geom ON shipping_lanes USING GIST (geom);
