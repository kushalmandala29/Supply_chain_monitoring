-- Demo/seed data for local development: sample shipping lanes and risk
-- geofences with real-world coordinates so the map has something to render,
-- animate, and click on. This is seed DATA (rows), not hardcoded application
-- logic -- nothing in the codebase branches on these specific names.
--
-- Run manually, e.g.:
--   docker compose exec -T postgres psql -U supply_chain -d supply_chain -f /seed.sql
-- (or from the host: cat databases/postgis/seed.sql | docker compose exec -T postgres psql -U supply_chain -d supply_chain)
--
-- origin_ref/destination_ref match the Port node `id`s in databases/neo4j/seed.cypher.
-- Geometry is a simple 2-point LineString (origin -> destination); the
-- frontend renders it as a great-circle-aware arc rather than a naive
-- straight line, so trans-Pacific routes don't visually cross the antimeridian
-- the wrong way.

-- route_id matches order_events.route_id / kpi_facts.entity_id / Neo4j's
-- CONNECTS_TO.route_id (databases/neo4j/seed.cypher) -- this is what lets
-- route KPI overlays join real on-time/cycle-time data onto these lanes
-- instead of falling back to status-only coloring (see migrate_route_id.sql
-- for backfilling a database seeded before this column existed).
INSERT INTO shipping_lanes (route_id, origin_ref, destination_ref, status, geom, metadata)
VALUES
    ('route-shanghai-la', 'port-shanghai', 'port-los-angeles', 'healthy',
     ST_GeomFromText('LINESTRING(121.49 31.22, -118.26 33.73)', 4326),
     '{"mode": "sea"}'::jsonb),
    ('route-shanghai-rotterdam', 'port-shanghai', 'port-rotterdam', 'delayed',
     ST_GeomFromText('LINESTRING(121.49 31.22, 4.14 51.95)', 4326),
     '{"mode": "sea"}'::jsonb),
    ('route-kaohsiung-la', 'port-kaohsiung', 'port-los-angeles', 'blocked',
     ST_GeomFromText('LINESTRING(120.28 22.61, -118.26 33.73)', 4326),
     '{"mode": "sea"}'::jsonb)
ON CONFLICT (route_id) DO NOTHING;

INSERT INTO geofences (source_stream, label, risk_level, geom, metadata)
VALUES
    ('seed', 'Typhoon near Taiwan Strait', 'high',
     ST_GeomFromText('POLYGON((118 21, 123 21, 123 26, 118 26, 118 21))', 4326),
     '{"event": "typhoon"}'::jsonb),
    ('seed', 'South China Sea Congestion', 'medium',
     ST_GeomFromText('POLYGON((108 5, 118 5, 118 15, 108 15, 108 5))', 4326),
     '{"event": "congestion"}'::jsonb);
