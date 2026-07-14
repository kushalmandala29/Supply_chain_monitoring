import { useMemo } from "react";
import { ArcLayer, PathLayer } from "@deck.gl/layers";
import { NetworkRoute, useJarvisStore } from "../../../store/useStore";
import { useWorkspaceStore } from "../../../store/useWorkspaceStore";

// route_id (e.g. "route-shanghai-la") is the shared key with order_events /
// kpi_facts / Neo4j's CONNECTS_TO -- shipping_lanes.id is only PostGIS's
// internal PK and was never joinable against KPI data. Older databases that
// haven't run databases/postgis/migrate_route_id.sql yet will still have a
// null route_id per row; falling back to the numeric id keeps those routes
// selectable, they just won't join to any KPI data until migrated.
function entityKeyFor(d: NetworkRoute): string {
  return d.route_id ?? String(d.id);
}

export function useRouteLayer(onSelectRoute?: (id: string, name: string, lat: number, lon: number) => void) {
  const routes = useJarvisStore((s) => s.networkRoutes);
  const correlationArcs = useJarvisStore((s) => s.correlationArcs);
  const kpiByEntity = useJarvisStore((s) => s.kpiByEntity);
  const selectedEntity = useWorkspaceStore((s) => s.selectedEntity);

  const pathLayer = useMemo(() => {
    // Real on-time-shipping-derived color/width when the route has joined
    // KPI data; falls back to the PostGIS status enum (healthy/delayed/
    // blocked) otherwise -- same fallback the README documents.
    const colorForRoute = (d: NetworkRoute): [number, number, number, number] => {
      const onTimeShipping = kpiByEntity[entityKeyFor(d)]?.kpis?.on_time_shipping?.value;
      if (typeof onTimeShipping === "number") {
        if (onTimeShipping >= 95) return [16, 185, 129, 200]; // emerald
        if (onTimeShipping >= 85) return [250, 204, 21, 200]; // amber
        return [239, 68, 68, 200]; // red
      }
      if (d.status === "delayed") return [250, 204, 21, 200];
      if (d.status === "blocked") return [239, 68, 68, 200];
      return [16, 185, 129, 100];
    };

    return new PathLayer<NetworkRoute>({
      id: "routes-layer",
      data: routes,
      pickable: true,
      widthScale: 1,
      widthMinPixels: 2,
      getPath: (d) => d.geometry.coordinates,
      getColor: (d) => {
        if (selectedEntity && selectedEntity.id === entityKeyFor(d)) {
          return [0, 255, 255, 255]; // highlight cyan
        }
        return colorForRoute(d);
      },
      getWidth: (d) => (selectedEntity && selectedEntity.id === entityKeyFor(d) ? 4 : 2),
      onClick: (info) => {
        if (info.object && onSelectRoute) {
          const coords = info.object.geometry.coordinates;
          const mid = coords[Math.floor(coords.length / 2)];
          onSelectRoute(
            entityKeyFor(info.object),
            `route from ${info.object.origin_ref} to ${info.object.destination_ref}`,
            mid[1],
            mid[0],
          );
        }
      },
      updateTriggers: {
        getColor: [selectedEntity?.id, kpiByEntity],
        getWidth: [selectedEntity?.id],
      },
    });
  }, [routes, selectedEntity, onSelectRoute, kpiByEntity]);

  const arcLayer = useMemo(() => {
    return new ArcLayer({
      id: "correlation-arcs-layer",
      data: correlationArcs,
      pickable: false,
      getSourcePosition: (d) => [d.fromLon, d.fromLat],
      getTargetPosition: (d) => [d.toLon, d.toLat],
      getSourceColor: [239, 68, 68, 200], // red
      getTargetColor: [239, 68, 68, 50],
      getWidth: 2,
    });
  }, [correlationArcs]);

  return { layers: [pathLayer, arcLayer] };
}
