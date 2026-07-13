// Supply-chain graph schema: suppliers, warehouses, ports, factories,
// dependencies, transport routes. No supplier/country/port names are
// hardcoded -- nodes are created at runtime from ETL/agent data.
//
// Run manually against the neo4j service, e.g.:
//   docker compose exec neo4j cypher-shell -u neo4j -p <password> -f /init/constraints.cypher

CREATE CONSTRAINT supplier_id IF NOT EXISTS FOR (n:Supplier) REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT factory_id IF NOT EXISTS FOR (n:Factory) REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT warehouse_id IF NOT EXISTS FOR (n:Warehouse) REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT port_id IF NOT EXISTS FOR (n:Port) REQUIRE n.id IS UNIQUE;

// Relationship shapes used by the Logistics Agent's traversals:
//   (:Supplier)-[:SUPPLIES]->(:Factory)
//   (:Factory)-[:SHIPS_TO]->(:Warehouse)
//   (:Warehouse)-[:ROUTES_THROUGH]->(:Port)
//   (:Port)-[:CONNECTS_TO {mode, distance_km}]->(:Port)
