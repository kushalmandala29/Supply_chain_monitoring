import { useMemo } from "react";
import { ArcLayer, PathLayer } from "@deck.gl/layers";
import { useJarvisStore } from "../../../store/useStore";
import { useWorkspaceStore } from "../../../store/useWorkspaceStore";

export function useRouteLayer(onSelectRoute?: (id: string, name: string, lat: number, lon: number) => void) {
  const routes = useJarvisStore((s) => s.networkRoutes);
  const correlationArcs = useJarvisStore((s) => s.correlationArcs);
  const selectedEntity = useWorkspaceStore((s) => s.selectedEntity);

  const pathLayer = useMemo(() => {
    return new PathLayer({
      id: "routes-layer",
      data: routes,
      pickable: true,
      widthScale: 1,
      widthMinPixels: 2,
      getPath: (d) => d.geometry.coordinates,
      getColor: (d) => {
        if (selectedEntity && selectedEntity.id === String(d.id)) {
          return [0, 255, 255, 255]; // highlight cyan
        }
        if (d.status === "delayed") return [250, 204, 21, 200]; // amber
        if (d.status === "blocked") return [239, 68, 68, 200]; // red
        return [16, 185, 129, 100]; // emerald ok
      },
      getWidth: (d) => (selectedEntity && selectedEntity.id === String(d.id) ? 4 : 2),
      onClick: (info) => {
        if (info.object && onSelectRoute) {
          const coords = info.object.geometry.coordinates;
          const mid = coords[Math.floor(coords.length / 2)];
          onSelectRoute(
            String(info.object.id),
            `Route ${info.object.origin_ref} to ${info.object.destination_ref}`,
            mid[1],
            mid[0],
          );
        }
      },
      updateTriggers: {
        getColor: [selectedEntity?.id],
        getWidth: [selectedEntity?.id],
      },
    });
  }, [routes, selectedEntity, onSelectRoute]);

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
