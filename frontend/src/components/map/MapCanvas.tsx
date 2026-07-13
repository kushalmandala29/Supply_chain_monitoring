import { useCallback, useEffect, useMemo, useState } from "react";
import Map from "react-map-gl/maplibre";
import DeckGL from "@deck.gl/react";
import { FlyToInterpolator } from "@deck.gl/core";

import { NewsPin, useJarvisStore } from "../../store/useStore";
import { useWorkspaceStore } from "../../store/useWorkspaceStore";
import { FacilityPoint, useFacilityLayer } from "./layers/useFacilityLayer";
import { useRouteLayer } from "./layers/useRouteLayer";
import { useRiskLayer } from "./layers/useRiskLayer";
import { useAlertLayer } from "./layers/useAlertLayer";
import { useCommodityHeatmapLayer } from "./layers/useCommodityHeatmapLayer";

// OpenFreeMap: free, keyless, no rate limits, MIT-derived OSM data --
// verified live style JSON (vector source + glyphs + sprite included).
// Self-hostable PMTiles is the documented fallback if this ever needs to
// move off a third-party host (see plan doc).
import { useNewsLayer } from "./layers/useNewsLayer";

const MAP_STYLE_URL = import.meta.env.VITE_MAP_STYLE_URL || "https://tiles.openfreemap.org/styles/dark";

const INITIAL_VIEW_STATE = { longitude: 10, latitude: 20, zoom: 1.5, pitch: 0, bearing: 0 };

export default function MapCanvas() {
  // Controlled view state -- deck.gl's `controller` prop otherwise owns the
  // camera internally when uncontrolled, and re-syncs its own (unchanged)
  // state on every re-render (KPI ticks, agent-status events, etc. all
  // re-render this component several times a second during a query), which
  // silently undoes an imperative `mapRef.flyTo()` call almost immediately.
  // Driving flyTo through this state instead makes deck.gl the single source
  // of truth for the camera, so nothing fights it.
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const mapMarker = useJarvisStore((s) => s.mapMarker);
  const sendQuery = useJarvisStore((s) => s.sendQuery);
  const setSelectedEntity = useWorkspaceStore((s) => s.setSelectedEntity);

  const flyTo = useCallback((lat: number, lon: number, zoom = 6) => {
    setViewState((prev) => ({
      ...prev,
      longitude: lon,
      latitude: lat,
      zoom,
      transitionDuration: 1400,
      transitionInterpolator: new FlyToInterpolator({ speed: 1.6 }),
    }));
  }, []);

  // Reactively pan whenever a query resolves to a place (mirrors the old
  // globe CameraController's mapMarker effect).
  useEffect(() => {
    if (!mapMarker) return;
    flyTo(mapMarker.lat, mapMarker.lon, 6);
  }, [mapMarker, flyTo]);

  // Every clickable thing on the map goes through this same three-step
  // pipeline -- select, fly, ask -- so clicking gets the identical live
  // response (streamed explanation, auto-popup imagery, highlights) that
  // typing the equivalent question would. Previously only facility clicks
  // did all three; routes/geofences/alerts/news pins only set the selection.
  const onSelectFacility = useCallback(
    (point: FacilityPoint) => {
      setSelectedEntity({ id: point.id, type: "facility", label: point.name });
      flyTo(point.position[1], point.position[0], 6);
      sendQuery(`Tell me about ${point.name}${point.country ? ` in ${point.country}` : ""}.`);
    },
    [flyTo, sendQuery, setSelectedEntity],
  );

  const onSelectRoute = useCallback(
    (id: string, name: string, lat: number, lon: number) => {
      setSelectedEntity({ id, type: "route", label: name });
      flyTo(lat, lon, 5);
      sendQuery(`What's the status of the shipping ${name}?`);
    },
    [flyTo, sendQuery, setSelectedEntity],
  );

  const onSelectGeofence = useCallback(
    (id: string, name: string, lat: number, lon: number) => {
      setSelectedEntity({ id, type: "geofence", label: name });
      flyTo(lat, lon, 5);
      sendQuery(`What's happening in the ${name} risk zone?`);
    },
    [flyTo, sendQuery, setSelectedEntity],
  );

  const onSelectAlert = useCallback(
    (entityId: string, kpi: string, lat: number, lon: number) => {
      setSelectedEntity({ id: entityId, type: "alert", label: `${entityId} · ${kpi}` });
      flyTo(lat, lon, 6);
      sendQuery(`Why is ${entityId}'s ${kpi.replace(/_/g, " ")} in alert?`);
    },
    [flyTo, sendQuery, setSelectedEntity],
  );

  const onSelectNewsPin = useCallback(
    (pin: NewsPin) => {
      flyTo(pin.lat, pin.lon, 6);
      sendQuery(`Tell me more about: ${pin.title}`);
    },
    [flyTo, sendQuery],
  );

  const mapLayers = useWorkspaceStore((s) => s.mapLayers);

  const { layer: facilityLayer, haloLayer: facilityHaloLayer } = useFacilityLayer(onSelectFacility);
  const { layers: routeLayers } = useRouteLayer(onSelectRoute);
  const { layers: riskLayers } = useRiskLayer(onSelectGeofence);
  const { layers: alertLayers } = useAlertLayer(onSelectAlert);
  const { layers: heatmapLayers } = useCommodityHeatmapLayer();
  const { layers: newsLayers } = useNewsLayer(onSelectNewsPin);

  // Gated by the Settings view's toggles (useWorkspaceStore.mapLayers) so the
  // map isn't permanently cluttered with every layer at once -- the commodity
  // heatmap in particular is still mock/random data until real commodity
  // feeds are wired up, so it defaults off.
  const layers = useMemo(() => [
    ...(mapLayers.commodityHeatmap ? heatmapLayers : []),
    ...(mapLayers.geofences ? riskLayers : []),
    ...(mapLayers.routes ? routeLayers : []),
    facilityHaloLayer,
    facilityLayer,
    ...newsLayers,
    ...(mapLayers.alerts ? alertLayers : []),
  ], [mapLayers, heatmapLayers, riskLayers, routeLayers, facilityHaloLayer, facilityLayer, newsLayers, alertLayers]);

  return (
    <div className="absolute inset-0">
      <DeckGL
        viewState={viewState}
        onViewStateChange={({ viewState: next }) => setViewState(next as typeof viewState)}
        controller
        layers={layers}
        style={{ position: "absolute", inset: "0" }}
      >
        <Map
          longitude={viewState.longitude}
          latitude={viewState.latitude}
          zoom={viewState.zoom}
          pitch={viewState.pitch}
          bearing={viewState.bearing}
          mapStyle={MAP_STYLE_URL}
        />
      </DeckGL>
    </div>
  );
}
