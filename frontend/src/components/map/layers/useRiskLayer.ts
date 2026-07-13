import { useMemo } from "react";
import { PolygonLayer } from "@deck.gl/layers";
import { useJarvisStore } from "../../../store/useStore";
import { useWorkspaceStore } from "../../../store/useWorkspaceStore";

export function useRiskLayer(onSelectGeofence?: (id: string, name: string, lat: number, lon: number) => void) {
  const geofences = useJarvisStore((s) => s.networkGeofences);
  const selectedEntity = useWorkspaceStore((s) => s.selectedEntity);

  const polygonLayer = useMemo(() => {
    return new PolygonLayer({
      id: "risk-layer",
      data: geofences,
      pickable: true,
      stroked: true,
      filled: true,
      extruded: false,
      getPolygon: (d) => d.geometry.coordinates,
      getFillColor: (d) => {
        if (d.risk_level === "high") return [239, 68, 68, 50]; // red
        if (d.risk_level === "medium") return [250, 204, 21, 50]; // amber
        return [16, 185, 129, 50]; // emerald
      },
      getLineColor: (d) => {
        if (selectedEntity && selectedEntity.id === String(d.id)) {
          return [0, 255, 255, 255]; // highlight cyan
        }
        if (d.risk_level === "high") return [239, 68, 68, 200];
        if (d.risk_level === "medium") return [250, 204, 21, 200];
        return [16, 185, 129, 200];
      },
      getLineWidth: (d) => (selectedEntity && selectedEntity.id === String(d.id) ? 4 : 2),
      lineWidthMinPixels: 2,
      onClick: (info) => {
        if (info.object && onSelectGeofence) {
          const ring = info.object.geometry.coordinates[0];
          const avgLat = ring.reduce((sum: number, c: number[]) => sum + c[1], 0) / ring.length;
          const avgLon = ring.reduce((sum: number, c: number[]) => sum + c[0], 0) / ring.length;
          onSelectGeofence(String(info.object.id), info.object.label, avgLat, avgLon);
        }
      },
      updateTriggers: {
        getLineColor: [selectedEntity?.id],
        getLineWidth: [selectedEntity?.id],
      },
    });
  }, [geofences, selectedEntity, onSelectGeofence]);

  return { layers: [polygonLayer] };
}
