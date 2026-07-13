import { useCallback, useMemo } from "react";

import { NetworkNode, useJarvisStore } from "../../store/useStore";

export interface RouteArc {
  id: string;
  kind: "route";
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  status: string;
  onTimeShipping?: number;
  cycleTimeHours?: number;
  originName: string;
  destName: string;
}

const STATUS_COLOR: Record<string, string> = {
  healthy: "#22c55e",
  delayed: "#f59e0b",
  blocked: "#ef4444",
};

/** color -> on-time shipping (falls back to the route's healthy/delayed/
 * blocked status if no KPI value has been computed for it yet). */
export function colorForRoute(route: RouteArc): string {
  if (typeof route.onTimeShipping === "number") {
    if (route.onTimeShipping >= 95) return "#22c55e";
    if (route.onTimeShipping >= 85) return "#f59e0b";
    return "#ef4444";
  }
  return STATUS_COLOR[route.status] ?? "#94a3b8";
}

/** animation speed -> order cycle time (shorter cycle time = faster dash
 * flow, i.e. the shipment is visibly moving quicker along the arc). */
export function dashSpeedForRoute(route: RouteArc): number {
  const hours = route.cycleTimeHours ?? 72;
  return Math.max(600, Math.min(6000, hours * 40));
}

/** Shipping routes as globe.gl arcsData, replacing WorldMap's ArcLayer.
 * NOTE: networkRoutes comes from PostGIS's shipping_lanes table (numeric
 * serial id), while kpi_facts route entities are keyed by the route_id text
 * property on Neo4j's CONNECTS_TO relationship -- these are different id
 * spaces in the current schema, so the on_time_shipping/cycle_time lookup
 * below only lights up once a route's kpi_facts entity_id is seeded to
 * match its shipping_lanes id; until then routes fall back to their
 * healthy/delayed/blocked status color, which is still fully functional. */
export function useRouteLayer(flyTo: (lat: number, lon: number, altitude: number) => void) {
  const networkNodes = useJarvisStore((s) => s.networkNodes);
  const networkRoutes = useJarvisStore((s) => s.networkRoutes);
  const kpiByEntity = useJarvisStore((s) => s.kpiByEntity);
  const sendQuery = useJarvisStore((s) => s.sendQuery);

  const nodesById = useMemo(
    () => new Map(networkNodes.map((n): [string, NetworkNode] => [n.id, n])),
    [networkNodes],
  );

  const arcs: RouteArc[] = useMemo(
    () =>
      networkRoutes.map((r) => {
        const [lon1, lat1] = r.geometry.coordinates[0];
        const [lon2, lat2] = r.geometry.coordinates[r.geometry.coordinates.length - 1];
        const routeKpis = kpiByEntity[String(r.id)]?.kpis;
        return {
          id: `route-${r.id}`,
          kind: "route" as const,
          startLat: lat1,
          startLng: lon1,
          endLat: lat2,
          endLng: lon2,
          status: r.status,
          onTimeShipping: routeKpis?.on_time_shipping?.value,
          cycleTimeHours: routeKpis?.order_cycle_time?.value,
          originName: nodesById.get(r.origin_ref)?.name ?? r.origin_ref,
          destName: nodesById.get(r.destination_ref)?.name ?? r.destination_ref,
        };
      }),
    [networkRoutes, kpiByEntity, nodesById],
  );

  const onArcClick = useCallback(
    (arc: object) => {
      const route = arc as RouteArc;
      flyTo((route.startLat + route.endLat) / 2, (route.startLng + route.endLng) / 2, 1.2);
      sendQuery(`What's the status of the shipping route from ${route.originName} to ${route.destName}?`);
    },
    [flyTo, sendQuery],
  );

  return { arcs, onArcClick };
}
