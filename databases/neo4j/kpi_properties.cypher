// KPI relationship-summary properties. Neo4j is NEVER the source of truth
// for these values -- PostgreSQL's kpi_facts table is authoritative, and
// every property below is write-through-synced at runtime by
// backend/app/services/kpi/repository.py:save_kpi_fact() via
//   MERGE (n {id: $entity_id}) SET n.<kpi_name> = $value
// immediately after a KPI is recomputed. Nothing here seeds a value -- this
// file only declares indexes so the graph queries below run fast, plus the
// query shapes themselves as documentation for the Logistics Agent.
//
// Run manually, same as constraints.cypher/seed.cypher:
//   docker compose exec neo4j cypher-shell -u neo4j -p change-me -f /init/kpi_properties.cypher
//
// Properties added (set at runtime, no schema/type enforcement needed since
// Neo4j is schema-optional for properties):
//   Warehouse: fill_rate, picking_accuracy, inventory_turnover, inventory_accuracy, days_on_hand
//   Supplier:  backorder_rate, cycle_time
//   Factory:   inventory_turnover, days_on_hand
//   Route:     on_time_shipping, cycle_time -- NOTE: there is no separate
//     :Route node in this graph (see constraints.cypher) -- routes are the
//     (:Port)-[:CONNECTS_TO {route_id, mode, distance_km}]->(:Port)
//     relationship, so these two properties are set on that relationship,
//     keyed by matching CONNECTS_TO.route_id to kpi_facts.entity_id.

CREATE INDEX warehouse_fill_rate IF NOT EXISTS FOR (n:Warehouse) ON (n.fill_rate);
CREATE INDEX warehouse_inventory_accuracy IF NOT EXISTS FOR (n:Warehouse) ON (n.inventory_accuracy);
CREATE INDEX supplier_cycle_time IF NOT EXISTS FOR (n:Supplier) ON (n.cycle_time);
CREATE INDEX connects_to_route_id IF NOT EXISTS FOR ()-[r:CONNECTS_TO]-() ON (r.route_id);
CREATE INDEX connects_to_on_time_shipping IF NOT EXISTS FOR ()-[r:CONNECTS_TO]-() ON (r.on_time_shipping);

// ---- Example graph queries (used by agents/logistics/main.py) ----

// Warehouses with fill rate below a threshold (threshold passed as $threshold
// from services/kpi/threshold_engine.py -- never hardcoded here):
// MATCH (w:Warehouse)
// WHERE w.fill_rate IS NOT NULL AND w.fill_rate < $threshold
// RETURN w.id AS id, w.name AS name, w.lat AS lat, w.lon AS lon, w.fill_rate AS fill_rate
// ORDER BY w.fill_rate ASC;

// Suppliers with the worst cycle times:
// MATCH (s:Supplier)
// WHERE s.cycle_time IS NOT NULL
// RETURN s.id AS id, s.name AS name, s.lat AS lat, s.lon AS lon, s.cycle_time AS cycle_time
// ORDER BY s.cycle_time DESC
// LIMIT $limit;

// Risky routes (on-time shipping below threshold):
// MATCH (a:Port)-[r:CONNECTS_TO]->(b:Port)
// WHERE r.on_time_shipping IS NOT NULL AND r.on_time_shipping < $threshold
// RETURN r.route_id AS route_id, a.id AS origin_id, b.id AS destination_id,
//        r.on_time_shipping AS on_time_shipping, r.cycle_time AS cycle_time
// ORDER BY r.on_time_shipping ASC;

// Facilities (any type) with poor inventory accuracy:
// MATCH (n)
// WHERE (n:Warehouse OR n:Factory) AND n.inventory_accuracy IS NOT NULL
//       AND n.inventory_accuracy < $threshold
// RETURN n.id AS id, labels(n)[0] AS type, n.name AS name, n.lat AS lat, n.lon AS lon,
//        n.inventory_accuracy AS inventory_accuracy
// ORDER BY n.inventory_accuracy ASC;
