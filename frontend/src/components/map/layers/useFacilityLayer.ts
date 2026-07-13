import { useMemo } from "react";
import { ScatterplotLayer } from "@deck.gl/layers";
import type { PickingInfo } from "@deck.gl/core";

import { KpiEntity, KpiSeverity, NetworkNode, useJarvisStore } from "../../../store/useStore";

export interface FacilityPoint {
  id: string;
  name: string;
  type: NetworkNode["type"];
  position: [number, number]; // [lon, lat]
  country?: string;
  severity: KpiSeverity;
  kpis: KpiEntity["kpis"] | undefined;
}

const TYPE_COLOR: Record<NetworkNode["type"], [number, number, number]> = {
  Supplier: [251, 191, 36],
  Factory: [96, 165, 250],
  Warehouse: [167, 139, 250],
  Port: [52, 211, 153],
};

const SEVERITY_COLOR: Record<KpiSeverity, [number, number, number]> = {
  green: [52, 211, 153],
  amber: [245, 158, 11],
  red: [239, 68, 68],
};

function worstSeverity(kpis: KpiEntity["kpis"] | undefined): KpiSeverity {
  if (!kpis) return "green";
  const severities = Object.values(kpis)
    .map((k) => k.severity)
    .filter((s): s is KpiSeverity => Boolean(s));
  if (severities.includes("red")) return "red";
  if (severities.includes("amber")) return "amber";
  return "green";
}

/** Facilities (suppliers/factories/warehouses/ports) as a deck.gl
 * ScatterplotLayer, replacing globe/FacilityLayer.tsx's globe.gl pointsData.
 * Color/radius encode KPI health, same logic as the globe version.
 * Clustering at low zoom is deferred to Phase 2. */
export function useFacilityLayer(onSelect: (point: FacilityPoint) => void) {
  const networkNodes = useJarvisStore((s) => s.networkNodes);
  const kpiByEntity = useJarvisStore((s) => s.kpiByEntity);

  const points: FacilityPoint[] = useMemo(
    () =>
      networkNodes.map((n) => {
        const kpis = kpiByEntity[n.id]?.kpis;
        return {
          id: n.id,
          name: n.name,
          type: n.type,
          position: [n.lon, n.lat],
          country: n.country,
          severity: worstSeverity(kpis),
          kpis,
        };
      }),
    [networkNodes, kpiByEntity],
  );

  // A halo layer under each marker draws the eye to amber/red facilities
  // without changing the marker's own color -- keeps type (fill) and KPI
  // health (outline) as two separate, legend-matched visual channels
  // instead of one color that silently means different things.
  const haloLayer = useMemo(
    () =>
      new ScatterplotLayer<FacilityPoint>({
        id: "facility-halo-layer",
        data: points.filter((d) => d.severity !== "green"),
        pickable: false,
        stroked: false,
        filled: true,
        radiusUnits: "pixels",
        getPosition: (d) => d.position,
        getRadius: (d) => (d.severity === "red" ? 20 : 16),
        getFillColor: (d) => [...SEVERITY_COLOR[d.severity], 55] as [number, number, number, number],
        updateTriggers: { getRadius: [points], getFillColor: [points] },
      }),
    [points],
  );

  const layer = useMemo(
    () =>
      new ScatterplotLayer<FacilityPoint>({
        id: "facility-layer",
        data: points,
        pickable: true,
        stroked: true,
        filled: true,
        radiusUnits: "pixels",
        getPosition: (d) => d.position,
        getRadius: (d) => (d.severity === "red" ? 11 : 8),
        getFillColor: (d) => TYPE_COLOR[d.type] ?? [148, 163, 184],
        getLineColor: (d) => (d.severity === "green" ? [255, 255, 255, 140] : [...SEVERITY_COLOR[d.severity], 255] as [number, number, number, number]),
        getLineWidth: (d) => (d.severity === "green" ? 1 : 2.5),
        lineWidthUnits: "pixels",
        lineWidthMinPixels: 1,
        onClick: (info: PickingInfo<FacilityPoint>) => {
          if (info.object) onSelect(info.object);
        },
        updateTriggers: {
          getFillColor: [points],
          getRadius: [points],
          getLineColor: [points],
          getLineWidth: [points],
        },
      }),
    [points, onSelect],
  );

  return { layer, haloLayer, points };
}
