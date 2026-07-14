-- Backfills shipping_lanes.route_id for databases created before that column
-- existed (init.sql now creates it directly). Safe to run more than once.
--
-- Run manually, e.g.:
--   docker compose exec -T postgres psql -U supply_chain -d supply_chain -f /migrate_route_id.sql
-- (or from the host: cat databases/postgis/migrate_route_id.sql | docker compose exec -T postgres psql -U supply_chain -d supply_chain)

ALTER TABLE shipping_lanes ADD COLUMN IF NOT EXISTS route_id TEXT;

-- Every row seeded via the original databases/postgis/seed.sql already carries
-- its route_id inside metadata (that was the original, never-surfaced bridge
-- value) -- pull it out into the real column for any row that doesn't have
-- one yet.
UPDATE shipping_lanes
SET route_id = metadata->>'route_id'
WHERE route_id IS NULL AND metadata ? 'route_id';

-- seed.sql originally had no ON CONFLICT guard, so a database re-seeded more
-- than once before that fix landed can have several rows sharing the same
-- route_id. Keep the oldest (lowest id) row per route_id and drop the rest
-- before the unique index below, which would otherwise fail to create.
DELETE FROM shipping_lanes a USING shipping_lanes b
WHERE a.route_id IS NOT NULL
  AND a.route_id = b.route_id
  AND a.id > b.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_shipping_lanes_route_id ON shipping_lanes (route_id) WHERE route_id IS NOT NULL;
