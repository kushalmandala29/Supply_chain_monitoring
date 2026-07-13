import { useMemo } from "react";

import { useJarvisStore } from "../../store/useStore";

const ALERT_TTL_MS = 5 * 60 * 1000; // rings fade out of the data set 5 minutes after the alert fired

const SEVERITY_COLOR: Record<string, string> = {
  amber: "#f59e0b",
  red: "#ef4444",
  green: "#22c55e",
};

export interface AlertRing {
  id: string;
  lat: number;
  lng: number;
  color: string;
}

/** Threshold-breach alerts (kpi.alert, see backend/app/services/kpi/
 * websocket_publisher.py) as globe.gl ringsData -- three-globe's built-in
 * ring propagation gives the "pulse" animation natively, no manual tick
 * loop needed. Location is resolved from either the KPI network snapshot
 * or the graph's network nodes, whichever has it. */
export function useAlertLayer() {
  const kpiAlerts = useJarvisStore((s) => s.kpiAlerts);
  const kpiByEntity = useJarvisStore((s) => s.kpiByEntity);
  const networkNodes = useJarvisStore((s) => s.networkNodes);

  const rings: AlertRing[] = useMemo(() => {
    const now = Date.now();
    const nodesById = new Map(networkNodes.map((n) => [n.id, n]));

    return kpiAlerts
      .filter((a) => now - a.receivedAt < ALERT_TTL_MS)
      .map((a) => {
        const node = nodesById.get(a.entity_id);
        if (node) return { id: a.id, lat: node.lat, lng: node.lon, color: SEVERITY_COLOR[a.severity] ?? "#ef4444" };

        const location = kpiByEntity[a.entity_id]?.location;
        if (location && "lat" in location) {
          return { id: a.id, lat: location.lat, lng: location.lon, color: SEVERITY_COLOR[a.severity] ?? "#ef4444" };
        }
        return null;
      })
      .filter((r): r is AlertRing => r !== null);
  }, [kpiAlerts, kpiByEntity, networkNodes]);

  return { rings };
}
