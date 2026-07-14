import { useMemo } from "react";
import { ScatterplotLayer } from "@deck.gl/layers";
import { useJarvisStore } from "../../../store/useStore";

export function useAlertLayer(onSelectAlert?: (entityId: string, kpi: string, lat: number, lon: number) => void) {
  const alerts = useJarvisStore((s) => s.kpiAlerts);
  const kpiByEntity = useJarvisStore((s) => s.kpiByEntity);

  const alertLayer = useMemo(() => {
    // We only want to show recent alerts, say within the last 5 minutes (300000 ms)
    const recentAlerts = alerts.filter((a) => Date.now() - a.receivedAt < 300000);

    // Map alerts to locations. Facility entities have a flat {lat, lon};
    // route entities have {origin, destination} instead (see
    // backend/app/api/kpi_router.py's _fetch_route_coords) -- without this
    // branch every route-entity alert (e.g. on_time_shipping breaches) was
    // silently dropped from the map entirely.
    const alertData = recentAlerts
      .map((alert) => {
        const location = kpiByEntity[alert.entity_id]?.location;
        if (!location) return null;
        if ("lat" in location) {
          return { ...alert, lat: location.lat, lon: location.lon };
        }
        return {
          ...alert,
          lat: (location.origin.lat + location.destination.lat) / 2,
          lon: (location.origin.lon + location.destination.lon) / 2,
        };
      })
      .filter((a): a is NonNullable<typeof a> => a !== null);

    return new ScatterplotLayer({
      id: "alert-layer",
      data: alertData,
      pickable: true,
      opacity: 0.8,
      stroked: true,
      filled: true,
      radiusScale: 1,
      radiusMinPixels: 10,
      radiusMaxPixels: 50,
      lineWidthMinPixels: 2,
      getPosition: (d) => [d.lon, d.lat],
      onClick: (info) => {
        if (info.object && onSelectAlert) {
          onSelectAlert(info.object.entity_id, info.object.kpi, info.object.lat, info.object.lon);
        }
      },
      getFillColor: (d) => {
        if (d.severity === "red") return [239, 68, 68, 100];
        if (d.severity === "amber") return [250, 204, 21, 100];
        return [16, 185, 129, 100];
      },
      getLineColor: (d) => {
        if (d.severity === "red") return [239, 68, 68, 255];
        if (d.severity === "amber") return [250, 204, 21, 255];
        return [16, 185, 129, 255];
      },
      getRadius: () => 10000, // Size in meters
      // To simulate pulsing, one could use a custom shader or animate radius over time
      // using updateTriggers and requestAnimationFrame. For now, a static pulsing visual 
      // is represented by the outline.
    });
  }, [alerts, kpiByEntity, onSelectAlert]);

  return { layers: [alertLayer] };
}
