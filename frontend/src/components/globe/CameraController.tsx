import { MutableRefObject, useCallback, useEffect } from "react";
import type { GlobeInstance } from "globe.gl";

import { useJarvisStore } from "../../store/useStore";

/** Camera fly-to helper, replacing WorldMap's FlyToInterpolator-driven
 * flyTo(). Also reacts to the store's mapMarker exactly like WorldMap did --
 * whatever place the latest query was geocoded to, the camera pans there. */
export function useCameraController(globeRef: MutableRefObject<GlobeInstance | null>) {
  const mapMarker = useJarvisStore((s) => s.mapMarker);

  const flyTo = useCallback(
    (lat: number, lon: number, altitude: number) => {
      globeRef.current?.pointOfView({ lat, lng: lon, altitude }, 1200);
    },
    [globeRef],
  );

  useEffect(() => {
    if (!mapMarker) return;
    flyTo(mapMarker.lat, mapMarker.lon, 0.9);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapMarker]);

  return { flyTo };
}
