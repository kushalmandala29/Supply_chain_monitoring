import { useMemo } from "react";
import { ScatterplotLayer } from "@deck.gl/layers";
import { NewsPin, useJarvisStore } from "../../../store/useStore";

export function useNewsLayer(onSelectNewsPin?: (pin: NewsPin) => void) {
  const mapPins = useJarvisStore((s) => s.mapPins);
  const newsPins = useJarvisStore((s) => s.newsPins);

  const mapPinsLayer = useMemo(
    () =>
      new ScatterplotLayer({
        id: "map-pins-layer",
        data: mapPins,
        pickable: true,
        stroked: true,
        filled: true,
        radiusUnits: "pixels",
        getPosition: (d) => [d.lon, d.lat],
        getRadius: (d) => (d.type === "focal" ? 12 : 8),
        getFillColor: (d) => (d.type === "focal" ? [167, 139, 250, 200] : [96, 165, 250, 200]),
        getLineColor: [255, 255, 255, 200],
        lineWidthMinPixels: 2,
        updateTriggers: {
          getPosition: [mapPins],
          getFillColor: [mapPins],
        },
      }),
    [mapPins],
  );

  // Ambient live news feed -- geocoded articles from the News ETL (fires
  // every few minutes independent of any user query), so breaking events
  // stay visible on the map continuously instead of only appearing as a
  // side effect of asking about them.
  const newsPinsLayer = useMemo(
    () =>
      new ScatterplotLayer<NewsPin>({
        id: "news-pins-layer",
        data: newsPins,
        pickable: true,
        stroked: true,
        filled: true,
        radiusUnits: "pixels",
        getPosition: (d) => [d.lon, d.lat],
        getRadius: 7,
        getFillColor: [59, 130, 246, 190],
        getLineColor: [255, 255, 255, 150],
        lineWidthMinPixels: 1,
        onClick: (info) => {
          if (info.object && onSelectNewsPin) onSelectNewsPin(info.object);
        },
        updateTriggers: {
          getPosition: [newsPins],
        },
      }),
    [newsPins, onSelectNewsPin],
  );

  return { layers: [mapPinsLayer, newsPinsLayer] };
}
