import { useMemo } from "react";
import { HeatmapLayer } from "@deck.gl/aggregation-layers";
import { useJarvisStore } from "../../../store/useStore";

export function useCommodityHeatmapLayer() {
  const nodes = useJarvisStore((s) => s.networkNodes);

  const heatmapLayer = useMemo(() => {
    // We mock the heatmap weights based on some node properties since 
    // a real commodity layer data isn't available yet in store.
    const heatmapData = nodes.map((node) => ({
      lon: node.lon,
      lat: node.lat,
      weight: Math.random() * 10,
    }));

    return new HeatmapLayer({
      id: "commodity-heatmap-layer",
      data: heatmapData,
      pickable: false,
      getPosition: (d) => [d.lon, d.lat],
      getWeight: (d) => d.weight,
      radiusPixels: 40,
      intensity: 1,
      threshold: 0.1,
    });
  }, [nodes]);

  return { layers: [heatmapLayer] };
}
