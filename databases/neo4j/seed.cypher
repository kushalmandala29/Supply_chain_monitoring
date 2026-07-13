// Demo/seed data for local development: a small, plausible supply-chain
// network with real-world coordinates so the map has something to render,
// animate, and click on. This is seed DATA (rows in the Knowledge Layer),
// not hardcoded application logic -- nothing in the codebase branches on
// these specific names; swap/extend this file freely.
//
// Run manually against the neo4j service, e.g.:
//   docker compose exec neo4j cypher-shell -u neo4j -p <password> -f /init/seed.cypher

MERGE (s1:Supplier {id: "supplier-tsmc"})
  SET s1.name = "TSMC Fab 15", s1.country = "Taiwan", s1.lat = 24.7, s1.lon = 121.0

MERGE (s2:Supplier {id: "supplier-ganfeng"})
  SET s2.name = "Ganfeng Lithium", s2.country = "China", s2.lat = 27.8, s2.lon = 114.9

MERGE (s3:Supplier {id: "supplier-freeport-cobalt"})
  SET s3.name = "Freeport Cobalt Refinery", s3.country = "Finland", s3.lat = 63.8, s3.lon = 23.1

MERGE (f1:Factory {id: "factory-foxconn-shenzhen"})
  SET f1.name = "Foxconn Shenzhen Assembly", f1.country = "China", f1.lat = 22.5, f1.lon = 114.0

MERGE (f2:Factory {id: "factory-tesla-shanghai"})
  SET f2.name = "Gigafactory Shanghai", f2.country = "China", f2.lat = 31.2, f2.lon = 121.5

MERGE (w1:Warehouse {id: "warehouse-la"})
  SET w1.name = "Los Angeles Distribution Center", w1.country = "USA", w1.lat = 33.79, w1.lon = -118.22

MERGE (w2:Warehouse {id: "warehouse-rotterdam"})
  SET w2.name = "Rotterdam Distribution Hub", w2.country = "Netherlands", w2.lat = 51.9, w2.lon = 4.48

MERGE (p1:Port {id: "port-shanghai"})
  SET p1.name = "Port of Shanghai", p1.country = "China", p1.lat = 31.22, p1.lon = 121.49

MERGE (p2:Port {id: "port-los-angeles"})
  SET p2.name = "Port of Los Angeles", p2.country = "USA", p2.lat = 33.73, p2.lon = -118.26

MERGE (p3:Port {id: "port-rotterdam"})
  SET p3.name = "Port of Rotterdam", p3.country = "Netherlands", p3.lat = 51.95, p3.lon = 4.14

MERGE (p4:Port {id: "port-kaohsiung"})
  SET p4.name = "Kaohsiung Port", p4.country = "Taiwan", p4.lat = 22.61, p4.lon = 120.28

WITH s1, s2, s3, f1, f2, w1, w2, p1, p2, p3, p4

MERGE (s1)-[:SUPPLIES]->(f1)
MERGE (s2)-[:SUPPLIES]->(f2)
MERGE (s3)-[:SUPPLIES]->(f2)
MERGE (f1)-[:SHIPS_TO]->(w1)
MERGE (f2)-[:SHIPS_TO]->(w2)
MERGE (w1)-[:ROUTES_THROUGH]->(p2)
MERGE (w2)-[:ROUTES_THROUGH]->(p3)
MERGE (f1)-[:ROUTES_THROUGH]->(p1)
MERGE (f2)-[:ROUTES_THROUGH]->(p1)

MERGE (p1)-[:CONNECTS_TO {mode: "sea", distance_km: 11600, route_id: "route-shanghai-la"}]->(p2)
MERGE (p1)-[:CONNECTS_TO {mode: "sea", distance_km: 19000, route_id: "route-shanghai-rotterdam"}]->(p3)
MERGE (p4)-[:CONNECTS_TO {mode: "sea", distance_km: 11500, route_id: "route-kaohsiung-la"}]->(p2);
