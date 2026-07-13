import { useCallback, useMemo } from "react";

import { KpiEntity, KpiSeverity, NetworkNode, useJarvisStore } from "../../store/useStore";

export interface FacilityPoint {
  id: string;
  name: string;
  type: NetworkNode["type"];
  lat: number;
  lng: number;
  country?: string;
  severity: KpiSeverity;
  kpis: KpiEntity["kpis"] | undefined;
}

const TYPE_COLOR: Record<NetworkNode["type"], string> = {
  Supplier: "#fbbf24",
  Factory: "#60a5fa",
  Warehouse: "#a78bfa",
  Port: "#34d399",
};

const SEVERITY_COLOR: Record<KpiSeverity, string> = {
  green: "#34d399",
  amber: "#f59e0b",
  red: "#ef4444",
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

/** Facilities (suppliers/factories/warehouses/ports) as globe.gl pointsData,
 * replacing WorldMap's ScatterplotLayer. Altitude/color encode KPI health;
 * alert pulses are layered on top separately (see AlertLayer). */
export function useFacilityLayer(flyTo: (lat: number, lon: number, altitude: number) => void) {
  const networkNodes = useJarvisStore((s) => s.networkNodes);
  const kpiByEntity = useJarvisStore((s) => s.kpiByEntity);
  const sendQuery = useJarvisStore((s) => s.sendQuery);

  const pointsData: FacilityPoint[] = useMemo(
    () =>
      networkNodes.map((n) => {
        const kpis = kpiByEntity[n.id]?.kpis;
        return {
          id: n.id,
          name: n.name,
          type: n.type,
          lat: n.lat,
          lng: n.lon,
          country: n.country,
          severity: worstSeverity(kpis),
          kpis,
        };
      }),
    [networkNodes, kpiByEntity],
  );

  const onPointClick = useCallback(
    (point: object) => {
      const facility = point as FacilityPoint;
      flyTo(facility.lat, facility.lng, 0.8);
      sendQuery(`Tell me about ${facility.name}${facility.country ? ` in ${facility.country}` : ""}.`);
    },
    [flyTo, sendQuery],
  );

  const pointColor = useCallback((d: object) => {
    const p = d as FacilityPoint;
    return p.severity === "green" ? TYPE_COLOR[p.type] ?? "#94a3b8" : SEVERITY_COLOR[p.severity];
  }, []);

  const pointAltitude = useCallback((d: object) => ((d as FacilityPoint).severity === "red" ? 0.02 : 0.012), []);
  const pointRadius = useCallback((d: object) => ((d as FacilityPoint).severity === "red" ? 0.55 : 0.35), []);
  const pointLabel = useCallback((d: object) => {
    const p = d as FacilityPoint;
    const fillRate = p.kpis?.fill_rate?.value;
    return `${p.name} (${p.type})${fillRate !== undefined ? ` -- fill rate ${fillRate.toFixed(0)}%` : ""}`;
  }, []);

  return { pointsData, pointColor, pointAltitude, pointRadius, pointLabel, onPointClick };
}
