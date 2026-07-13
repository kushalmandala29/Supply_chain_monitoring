import { FlyToInterpolator, Layer } from "@deck.gl/core";
import { ArcLayer, PolygonLayer, ScatterplotLayer } from "@deck.gl/layers";
import DeckGL from "@deck.gl/react";
import { useEffect, useMemo, useState } from "react";
import MaplibreMap from "react-map-gl/maplibre";

import "maplibre-gl/dist/maplibre-gl.css";

import { NetworkGeofence, NetworkNode, NetworkRoute, NewsPin, useJarvisStore } from "../../store/useStore";

const NEWS_PIN_TTL_MS = 10 * 60 * 1000; // live feed pins fade out over 10 minutes

// CARTO's Dark Matter style: free, no API key, and actually dark -- fits the
// Jarvis HUD aesthetic far better than OpenFreeMap's colorful default styles.
const DEFAULT_MAP_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const INITIAL_VIEW_STATE = {
  longitude: 0,
  latitude: 20,
  zoom: 1.6,
  pitch: 0,
  bearing: 0,
};

const NODE_COLOR: Record<NetworkNode["type"], [number, number, number]> = {
  Supplier: [251, 191, 36],
  Factory: [96, 165, 250],
  Warehouse: [167, 139, 250],
  Port: [52, 211, 153],
};

const ROUTE_COLOR: Record<string, [number, number, number]> = {
  healthy: [34, 197, 94],
  delayed: [245, 158, 11],
  blocked: [239, 68, 68],
};

const RISK_COLOR: Record<string, [number, number, number]> = {
  high: [239, 68, 68],
  medium: [245, 158, 11],
  low: [234, 179, 8],
};

// Deterministic per-feature phase offset so pulses don't all beat in sync.
function phaseFromId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) % 1000;
  return hash;
}

export default function WorldMap() {
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [tick, setTick] = useState(0);
  const mapMarker = useJarvisStore((s) => s.mapMarker);
  const networkNodes = useJarvisStore((s) => s.networkNodes);
  const networkRoutes = useJarvisStore((s) => s.networkRoutes);
  const networkGeofences = useJarvisStore((s) => s.networkGeofences);
  const newsPins = useJarvisStore((s) => s.newsPins);
  const sendQuery = useJarvisStore((s) => s.sendQuery);

  // Drives the pulsing/breathing animation on nodes, routes, and geofences.
  useEffect(() => {
    let frame: number;
    const animate = (time: number) => {
      setTick(time);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

  const flyTo = (lat: number, lon: number, zoom: number) => {
    setViewState((prev) => ({
      ...prev,
      latitude: lat,
      longitude: lon,
      zoom,
      transitionDuration: 1200,
      transitionInterpolator: new FlyToInterpolator(),
    }));
  };

  // Dynamic camera navigation: pan/zoom to whatever place the latest query
  // was geocoded to (PRD 6.2).
  useEffect(() => {
    if (!mapMarker) return;
    flyTo(mapMarker.lat, mapMarker.lon, 5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapMarker]);

  const nodesById = useMemo(
    () => new Map(networkNodes.map((n): [string, NetworkNode] => [n.id, n])),
    [networkNodes],
  );

  // Clicking any map feature asks the same question a typed query would --
  // it goes through the identical query.received -> agents -> supervisor
  // pipeline, just with the question text generated from what was clicked.
  const handleNodeClick = (node: NetworkNode) => {
    flyTo(node.lat, node.lon, 6);
    sendQuery(`Tell me about ${node.name}${node.country ? ` in ${node.country}` : ""}.`);
  };

  const handleRouteClick = (route: NetworkRoute) => {
    const [lon1, lat1] = route.geometry.coordinates[0];
    const [lon2, lat2] = route.geometry.coordinates[route.geometry.coordinates.length - 1];
    flyTo((lat1 + lat2) / 2, (lon1 + lon2) / 2, 2.5);
    const originName = nodesById.get(route.origin_ref)?.name ?? route.origin_ref;
    const destName = nodesById.get(route.destination_ref)?.name ?? route.destination_ref;
    sendQuery(`What's the status of the shipping route from ${originName} to ${destName}?`);
  };

  const handleGeofenceClick = (geofence: NetworkGeofence) => {
    const coords = geofence.geometry.coordinates[0];
    const avgLat = coords.reduce((sum, c) => sum + c[1], 0) / coords.length;
    const avgLon = coords.reduce((sum, c) => sum + c[0], 0) / coords.length;
    flyTo(avgLat, avgLon, 4);
    sendQuery(`What's happening in the ${geofence.label} risk zone?`);
  };

  const layers = useMemo(() => {
    const nodeLayer = new ScatterplotLayer<NetworkNode>({
      id: "network-nodes",
      data: networkNodes,
      getPosition: (d) => [d.lon, d.lat],
      getFillColor: (d) => NODE_COLOR[d.type] ?? [148, 163, 184],
      getRadius: (d) => 28000 + 12000 * Math.sin(tick / 400 + phaseFromId(d.id)),
      radiusMinPixels: 4,
      radiusMaxPixels: 16,
      pickable: true,
      onClick: ({ object }) => object && handleNodeClick(object),
    });

    const routeLayer = new ArcLayer<NetworkRoute>({
      id: "shipping-routes",
      data: networkRoutes,
      getSourcePosition: (d) => d.geometry.coordinates[0],
      getTargetPosition: (d) => d.geometry.coordinates[d.geometry.coordinates.length - 1],
      getSourceColor: (d) => [...(ROUTE_COLOR[d.status] ?? [148, 163, 184]), 200],
      getTargetColor: (d) => [...(ROUTE_COLOR[d.status] ?? [148, 163, 184]), 200],
      getWidth: (d) => 2 + 1.5 * (0.5 + 0.5 * Math.sin(tick / 300 + phaseFromId(String(d.id)))),
      greatCircle: true,
      pickable: true,
      onClick: ({ object }) => object && handleRouteClick(object),
    });

    const geofenceLayer = new PolygonLayer<NetworkGeofence>({
      id: "risk-geofences",
      data: networkGeofences,
      getPolygon: (d) => d.geometry.coordinates[0],
      getFillColor: (d) => {
        const [r, g, b] = RISK_COLOR[d.risk_level] ?? [148, 163, 184];
        const alpha = 35 + 30 * (0.5 + 0.5 * Math.sin(tick / 500 + phaseFromId(String(d.id))));
        return [r, g, b, alpha];
      },
      getLineColor: (d) => RISK_COLOR[d.risk_level] ?? [148, 163, 184],
      lineWidthMinPixels: 2,
      stroked: true,
      filled: true,
      pickable: true,
      onClick: ({ object }) => object && handleGeofenceClick(object),
    });

    const layerList: Layer[] = [geofenceLayer, routeLayer, nodeLayer];

    if (mapMarker) {
      layerList.push(
        new ScatterplotLayer({
          id: "query-location",
          data: [mapMarker],
          getPosition: (d: typeof mapMarker) => [d.lon, d.lat],
          getFillColor: [34, 211, 238],
          getRadius: 40000,
          radiusMinPixels: 6,
          radiusMaxPixels: 20,
          pickable: true,
        }),
      );
    }

    // Live global feed: geocoded ambient news articles, fading out over
    // NEWS_PIN_TTL_MS while still pulsing so recent ones read as "live".
    const liveNewsLayer = new ScatterplotLayer<NewsPin>({
      id: "live-news-feed",
      data: newsPins,
      getPosition: (d) => [d.lon, d.lat],
      getFillColor: (d) => {
        const fade = Math.max(0, 1 - (Date.now() - d.receivedAt) / NEWS_PIN_TTL_MS);
        const pulse = 0.6 + 0.4 * Math.sin(tick / 250 + phaseFromId(d.id));
        return [251, 113, 133, Math.round(220 * fade * pulse)];
      },
      getRadius: (d) => {
        const fade = Math.max(0, 1 - (Date.now() - d.receivedAt) / NEWS_PIN_TTL_MS);
        return (18000 + 15000 * Math.sin(tick / 300 + phaseFromId(d.id))) * fade;
      },
      radiusMinPixels: 3,
      radiusMaxPixels: 12,
      pickable: true,
      onClick: ({ object }) => object?.url && window.open(object.url, "_blank", "noopener,noreferrer"),
    });
    layerList.push(liveNewsLayer);

    return layerList;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [networkNodes, networkRoutes, networkGeofences, mapMarker, newsPins, tick, nodesById]);

  return (
    <DeckGL
      viewState={viewState}
      onViewStateChange={({ viewState: nextViewState }) =>
        setViewState(nextViewState as typeof INITIAL_VIEW_STATE)
      }
      controller
      layers={layers}
      style={{ position: "absolute", top: "0", left: "0", right: "0", bottom: "0" }}
    >
      <MaplibreMap mapStyle={import.meta.env.VITE_MAP_STYLE_URL || DEFAULT_MAP_STYLE} />
    </DeckGL>
  );
}
