import { useMemo } from "react";

import { useJarvisStore } from "../../store/useStore";

const CORRELATION_TTL_MS = 3 * 60 * 1000; // temporary arcs disappear 3 minutes after the event fired

export interface CorrelationArcVisual {
  id: string;
  kind: "correlation";
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  note: string;
}

/** Temporary event -> facility arcs drawn when the Intel Agent's news ->
 * graph -> KPI impact pipeline finds nearby facilities that may degrade
 * (see agents/intel/main.py's kpi_impact + useStore.ts's correlationArcs
 * reducer branch). Merged into GlobeScene's single arcsData array
 * alongside the shipping-route arcs, distinguished by `kind`. */
export function useCorrelationLayer() {
  const correlationArcs = useJarvisStore((s) => s.correlationArcs);

  const arcs: CorrelationArcVisual[] = useMemo(() => {
    const now = Date.now();
    return correlationArcs
      .filter((a) => now - a.receivedAt < CORRELATION_TTL_MS)
      .map((a) => ({
        id: a.id,
        kind: "correlation" as const,
        startLat: a.fromLat,
        startLng: a.fromLon,
        endLat: a.toLat,
        endLng: a.toLon,
        note: a.note,
      }));
  }, [correlationArcs]);

  return { arcs };
}
