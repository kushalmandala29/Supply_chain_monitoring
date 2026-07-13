import { useEffect, useRef, useState } from "react";
import Globe from "globe.gl";
import type { GlobeInstance } from "globe.gl";
import { createRoot, Root } from "react-dom/client";

import { NetworkGeofence, useJarvisStore } from "../../store/useStore";
import KpiRing from "../HUD/kpi/KpiRing";
import { useAlertLayer } from "./AlertLayer";
import { useCameraController } from "./CameraController";
import { CorrelationArcVisual, useCorrelationLayer } from "./CorrelationLayer";
import { FacilityPoint, useFacilityLayer } from "./FacilityLayer";
import { colorForRoute, dashSpeedForRoute, RouteArc, useRouteLayer } from "./RouteLayer";

// The two arc "kinds" that share globe.gl's single arcsData array.
type ArcDatum = RouteArc | CorrelationArcVisual;

// Copied from three-globe/example/img/ into frontend/public/globe/ (see
// package.json's "exports" map, which blocks deep-importing those files
// directly as ES modules) -- self-hosted rather than fetched from a CDN, so
// the globe renders correctly even behind an ad-blocker/firewall that
// blocks unpkg.com. Overridable via env vars if you want different textures.
const GLOBE_IMAGE_URL = import.meta.env.VITE_GLOBE_IMAGE_URL || "/globe/earth-dark.jpg";
const GLOBE_BUMP_URL = import.meta.env.VITE_GLOBE_BUMP_URL || "/globe/earth-topology.png";
const GLOBE_BACKGROUND_URL = import.meta.env.VITE_GLOBE_BACKGROUND_URL || "/globe/night-sky.png";

const RISK_COLOR: Record<string, string> = { high: "#ef4444", medium: "#f59e0b", low: "#eab308" };

const DEFAULT_POINT_OF_VIEW = { lat: 20, lng: 0, altitude: 2.4 };
// GlobeHUD's "Reset view" button dispatches this -- decoupled via a window
// event rather than a lifted ref, since GlobeScene owns the only Globe
// instance and nothing else needs a broader imperative API into it yet.
export const RESET_VIEW_EVENT = "jarvis:reset-globe-view";

export default function GlobeScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<GlobeInstance | null>(null);
  const kpiRingRootsRef = useRef<Map<string, { container: HTMLElement; root: Root }>>(new Map());
  const [ready, setReady] = useState(false);

  const networkGeofences = useJarvisStore((s) => s.networkGeofences);
  const sendQuery = useJarvisStore((s) => s.sendQuery);

  const { flyTo } = useCameraController(globeRef);
  const facility = useFacilityLayer(flyTo);
  const route = useRouteLayer(flyTo);
  const alert = useAlertLayer();
  const correlation = useCorrelationLayer();

  // Mount the Globe instance once. Orbit controls (drag to orbit, scroll to
  // zoom, right-drag/two-finger to pan) and a slow auto-rotate come from
  // three-globe's built-in OrbitControls -- tilt is just orbiting with a
  // non-zero polar angle, which OrbitControls already supports by default.
  useEffect(() => {
    if (!containerRef.current) return undefined;

    const globe = new Globe(containerRef.current)
      .globeImageUrl(GLOBE_IMAGE_URL)
      .bumpImageUrl(GLOBE_BUMP_URL)
      .backgroundImageUrl(GLOBE_BACKGROUND_URL)
      .showAtmosphere(true)
      .atmosphereColor("#22d3ee")
      .atmosphereAltitude(0.2)
      .pointOfView(DEFAULT_POINT_OF_VIEW);

    const controls = globe.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.35;
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.minDistance = 130;
    controls.maxDistance = 800;
    controls.addEventListener("start", () => {
      controls.autoRotate = false;
    });

    globeRef.current = globe;
    setReady(true);
    const resize = () => {
      if (!containerRef.current) return;
      globe.width(containerRef.current.clientWidth);
      globe.height(containerRef.current.clientHeight);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(containerRef.current);

    const resetView = () => globeRef.current?.pointOfView(DEFAULT_POINT_OF_VIEW, 1000);
    window.addEventListener(RESET_VIEW_EVENT, resetView);

    return () => {
      observer.disconnect();
      window.removeEventListener(RESET_VIEW_EVENT, resetView);
      globeRef.current = null;
      for (const { root } of kpiRingRootsRef.current.values()) root.unmount();
      kpiRingRootsRef.current.clear();
      (globe as unknown as { _destructor?: () => void })._destructor?.();
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, []);

  // Facilities (points): altitude/color encode KPI health.
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    globe
      .pointsData(facility.pointsData)
      .pointColor(facility.pointColor)
      .pointAltitude(facility.pointAltitude)
      .pointRadius(facility.pointRadius)
      .pointLabel(facility.pointLabel)
      .onPointClick(facility.onPointClick);
  }, [
    ready,
    facility.pointsData,
    facility.pointColor,
    facility.pointAltitude,
    facility.pointRadius,
    facility.pointLabel,
    facility.onPointClick,
  ]);

  // Concentric KPI rings, anchored to each facility's lat/lng via
  // globe.gl's htmlElementsData layer (the WebGL pointsData marker above
  // stays visible at every zoom level; these rich/hoverable rings render
  // on top once close enough to read). One React root per facility,
  // cached in kpiRingRootsRef and re-rendered in place as KPI data changes.
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    globe
      .htmlElementsData(facility.pointsData)
      .htmlLat((d: object) => (d as FacilityPoint).lat)
      .htmlLng((d: object) => (d as FacilityPoint).lng)
      .htmlAltitude(0.015)
      .htmlElement((d: object) => {
        const point = d as FacilityPoint;
        let entry = kpiRingRootsRef.current.get(point.id);
        if (!entry) {
          const container = document.createElement("div");
          container.style.pointerEvents = "auto";
          entry = { container, root: createRoot(container) };
          kpiRingRootsRef.current.set(point.id, entry);
        }
        entry.root.render(
          <KpiRing entityId={point.id} entityName={point.name} kpis={point.kpis ?? {}} size={36} />,
        );
        return entry.container;
      });
  }, [ready, facility.pointsData]);

  // Shipping routes + temporary correlation arcs share globe.gl's single
  // arcsData array, distinguished by `kind`.
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    const merged = [...route.arcs, ...correlation.arcs];
    globe
      .arcsData(merged)
      .arcColor((d: object) => {
        const arc = d as ArcDatum;
        return arc.kind === "correlation" ? "#fb7185" : colorForRoute(arc);
      })
      .arcDashLength(0.4)
      .arcDashGap(0.2)
      .arcDashAnimateTime((d: object) => {
        const arc = d as ArcDatum;
        return arc.kind === "correlation" ? 1000 : dashSpeedForRoute(arc);
      })
      .arcStroke((d: object) => ((d as ArcDatum).kind === "correlation" ? 0.4 : 0.6))
      .arcLabel((d: object) => {
        const arc = d as ArcDatum;
        return arc.kind === "correlation" ? arc.note : `${arc.originName} → ${arc.destName}`;
      })
      .onArcClick((arcObj: object) => {
        const arc = arcObj as ArcDatum;
        if (arc.kind !== "correlation") route.onArcClick(arcObj);
      });
  }, [ready, route.arcs, route.onArcClick, correlation.arcs]);

  // Risk geofences (polygons).
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    globe
      .polygonsData(networkGeofences)
      // three-globe's own GeoJsonGeometry type declares coordinates as a
      // flat number[] (too narrow for real Polygon geometry, which nests
      // three levels deep) -- our data is valid GeoJSON, so this cast just
      // works around that upstream type gap.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .polygonGeoJsonGeometry((d: object) => (d as NetworkGeofence).geometry as any)
      .polygonCapColor((d: object) => `${RISK_COLOR[(d as NetworkGeofence).risk_level] ?? "#94a3b8"}55`)
      .polygonSideColor(() => "rgba(0,0,0,0.15)")
      .polygonStrokeColor((d: object) => RISK_COLOR[(d as NetworkGeofence).risk_level] ?? "#94a3b8")
      .polygonAltitude(0.01)
      .polygonLabel((d: object) => (d as NetworkGeofence).label)
      .onPolygonClick((polyObj: object) => {
        const geofence = polyObj as NetworkGeofence;
        const coords = geofence.geometry.coordinates[0];
        const avgLat = coords.reduce((sum, c) => sum + c[1], 0) / coords.length;
        const avgLon = coords.reduce((sum, c) => sum + c[0], 0) / coords.length;
        flyTo(avgLat, avgLon, 1.0);
        sendQuery(`What's happening in the ${geofence.label} risk zone?`);
      });
  }, [ready, networkGeofences, flyTo, sendQuery]);

  // Alert pulses (rings) -- three-globe's built-in ring propagation
  // animates these natively, no manual tick loop required.
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    globe
      .ringsData(alert.rings)
      .ringColor(() => (t: number) => `rgba(239, 68, 68, ${1 - t})`)
      .ringMaxRadius(3)
      .ringPropagationSpeed(3)
      .ringRepeatPeriod(900);
  }, [ready, alert.rings]);

  return <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />;
}
