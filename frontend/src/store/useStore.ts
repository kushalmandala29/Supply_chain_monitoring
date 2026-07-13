import { create } from "zustand";

export type StreamKey =
  | "query_router"
  | "agent_status"
  | "news_ingested"
  | "weather_updated"
  | "commodity_updated"
  | "satellite_ready"
  | "route_recomputed"
  | "risk_detected"
  | "explanation_updated"
  | "kpi_update"
  | "kpi_alert";

export interface AgentTraceEntry {
  id: string;
  stream: StreamKey;
  payload: Record<string, unknown>;
  receivedAt: number;
}

export interface MapMarker {
  lat: number;
  lon: number;
  label?: string;
}

export interface Source {
  title?: string;
  url?: string;
  content?: string;
}

export interface NetworkNode {
  id: string;
  name: string;
  type: "Supplier" | "Factory" | "Warehouse" | "Port";
  lat: number;
  lon: number;
  country?: string;
}

export interface NetworkRoute {
  id: number;
  origin_ref: string;
  destination_ref: string;
  status: string;
  geometry: { type: "LineString"; coordinates: [number, number][] };
}

export interface NetworkGeofence {
  id: number;
  label: string;
  risk_level: string;
  geometry: { type: "Polygon"; coordinates: number[][][] };
}

export interface NewsPin {
  id: string;
  lat: number;
  lon: number;
  title: string;
  url?: string;
  receivedAt: number;
}

export type KpiSeverity = "green" | "amber" | "red";

export interface KpiConfigEntry {
  interval: string;
  entities: string[];
  direction: "higher_is_better" | "lower_is_better";
  thresholds: { green: number; amber: number; red: number };
  alert: boolean;
}

export interface KpiValue {
  value: number;
  computedAt: string;
  severity?: KpiSeverity;
}

export interface KpiEntity {
  entityId: string;
  entityType: string;
  location: { lat: number; lon: number } | { origin: { lat: number; lon: number }; destination: { lat: number; lon: number } } | null;
  kpis: Record<string, KpiValue>;
}

export interface CorrelationArc {
  id: string;
  fromLat: number;
  fromLon: number;
  toLat: number;
  toLon: number;
  note: string;
  receivedAt: number;
}

export interface KpiAlert {
  id: string;
  entity_id: string;
  entity_type: string;
  kpi: string;
  current: number;
  threshold: number | null;
  severity: KpiSeverity;
  timestamp: string;
  receivedAt: number;
}

interface Article {
  title?: string;
  url?: string;
  location?: { lat: number; lon: number; label?: string };
}

interface JarvisState {
  connectionStatus: "connecting" | "open" | "closed";
  trace: AgentTraceEntry[];
  explanation: string | null;
  sources: Source[];
  activeAgents: string[];
  queryStartedAt: number | null;
  lastQueryDurationMs: number | null;
  mapMarker: MapMarker | null;
  networkNodes: NetworkNode[];
  networkRoutes: NetworkRoute[];
  networkGeofences: NetworkGeofence[];
  newsPins: NewsPin[];
  kpiByEntity: Record<string, KpiEntity>;
  kpiAlerts: KpiAlert[];
  kpiDashboard: Record<string, number>;
  kpiConfig: Record<string, KpiConfigEntry>;
  correlationArcs: CorrelationArc[];
  sendQuery: (query: string) => void;
  setConnectionStatus: (status: JarvisState["connectionStatus"]) => void;
  setSendQuery: (sendQuery: (query: string) => void) => void;
  ingest: (stream: StreamKey, payload: Record<string, unknown>) => void;
  fetchNetwork: () => Promise<void>;
  fetchKpiNetwork: () => Promise<void>;
  fetchKpiDashboard: () => Promise<void>;
  fetchKpiConfig: () => Promise<void>;
}

// Module-level (not store state) debounce timer for GlobalDashboard's
// live-refresh-on-KPI-activity behavior -- see the kpi_update/kpi_alert
// branch in ingest() below.
let dashboardRefreshTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleDashboardRefresh(get: () => JarvisState): void {
  if (dashboardRefreshTimer) clearTimeout(dashboardRefreshTimer);
  dashboardRefreshTimer = setTimeout(() => {
    get().fetchKpiDashboard();
  }, 1500);
}

export const useJarvisStore = create<JarvisState>((set, get) => ({
  connectionStatus: "connecting",
  trace: [],
  explanation: null,
  sources: [],
  activeAgents: [],
  queryStartedAt: null,
  lastQueryDurationMs: null,
  mapMarker: null,
  networkNodes: [],
  networkRoutes: [],
  networkGeofences: [],
  newsPins: [],
  kpiByEntity: {},
  kpiAlerts: [],
  kpiDashboard: {},
  kpiConfig: {},
  correlationArcs: [],
  sendQuery: () => {
    console.warn("sendQuery called before the WebSocket connection was ready");
  },
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setSendQuery: (sendQuery) => set({ sendQuery }),
  ingest: (stream, payload) =>
    set((state) => {
      const entry: AgentTraceEntry = {
        id: `${stream}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        stream,
        payload,
        receivedAt: Date.now(),
      };

      const next: Partial<JarvisState> = {
        trace: [...state.trace.slice(-49), entry],
      };

      if (stream === "query_router" && Array.isArray(payload.agents)) {
        next.activeAgents = payload.agents as string[];
        next.queryStartedAt = Date.now();
        next.lastQueryDurationMs = null;
      }
      if (stream === "explanation_updated" && typeof payload.explanation === "string") {
        next.explanation = payload.explanation;
        next.sources = Array.isArray(payload.sources) ? (payload.sources as Source[]) : [];
        if (state.queryStartedAt !== null) {
          next.lastQueryDurationMs = Date.now() - state.queryStartedAt;
        }
        const location = payload.location as MapMarker | null | undefined;
        if (location && typeof location.lat === "number" && typeof location.lon === "number") {
          next.mapMarker = location;
        }
      }

      // Ambient KPI broadcasts (no session_id -- see backend/app/services/kpi/
      // websocket_publisher.py) -- kept in a flat entity_id -> kpi_name map so
      // FacilityLayer/KpiRing can look up "does this facility have a recent
      // value" without re-deriving it from the trace log.
      if (stream === "kpi_update" && typeof payload.entity_id === "string") {
        const entityId = payload.entity_id as string;
        const existing = state.kpiByEntity[entityId];
        next.kpiByEntity = {
          ...state.kpiByEntity,
          [entityId]: {
            entityId,
            entityType: (payload.entity_type as string) ?? existing?.entityType ?? "unknown",
            location: existing?.location ?? null,
            kpis: {
              ...(existing?.kpis ?? {}),
              [payload.kpi_name as string]: {
                value: payload.kpi_value as number,
                computedAt: payload.computed_at as string,
                severity: payload.severity as KpiSeverity | undefined,
              },
            },
          },
        };
        scheduleDashboardRefresh(get);
      }

      if (stream === "kpi_alert" && typeof payload.entity_id === "string") {
        const alert: KpiAlert = {
          id: `${payload.entity_id}-${payload.kpi}-${Date.now()}`,
          entity_id: payload.entity_id as string,
          entity_type: payload.entity_type as string,
          kpi: payload.kpi as string,
          current: payload.current as number,
          threshold: (payload.threshold as number) ?? null,
          severity: payload.severity as KpiSeverity,
          timestamp: payload.timestamp as string,
          receivedAt: Date.now(),
        };
        next.kpiAlerts = [...state.kpiAlerts.slice(-49), alert];
        scheduleDashboardRefresh(get);
      }

      // Intel Agent's news -> graph -> KPI impact pipeline: draws a
      // temporary event -> facility arc for each nearby facility whose KPIs
      // may degrade (CorrelationLayer prunes these by age).
      if (
        stream === "news_ingested" &&
        payload.location &&
        typeof (payload.location as { lat?: number }).lat === "number" &&
        Array.isArray(payload.kpi_impact)
      ) {
        const eventLocation = payload.location as { lat: number; lon: number };
        const newArcs: CorrelationArc[] = (payload.kpi_impact as Array<Record<string, unknown>>)
          .filter((impact) => typeof impact.lat === "number" && typeof impact.lon === "number")
          .map((impact) => ({
            id: `${impact.entity_id}-${Date.now()}`,
            fromLat: eventLocation.lat,
            fromLon: eventLocation.lon,
            toLat: impact.lat as number,
            toLon: impact.lon as number,
            note: (impact.note as string) ?? "",
            receivedAt: Date.now(),
          }));
        if (newArcs.length > 0) {
          next.correlationArcs = [...state.correlationArcs.slice(-19), ...newArcs];
        }
      }

      // Ambient live feed: articles the News ETL managed to geocode get a
      // fading pin on the map (WorldMap prunes/animates by age).
      if (stream === "news_ingested" && Array.isArray(payload.articles)) {
        const geocoded = (payload.articles as Article[]).filter(
          (a): a is Article & { location: NonNullable<Article["location"]> } =>
            !!a.location && typeof a.location.lat === "number" && typeof a.location.lon === "number",
        );
        if (geocoded.length > 0) {
          const newPins: NewsPin[] = geocoded.map((a) => ({
            id: `${a.url ?? a.title}-${Date.now()}`,
            lat: a.location.lat,
            lon: a.location.lon,
            title: a.title ?? "Untitled",
            url: a.url,
            receivedAt: Date.now(),
          }));
          next.newsPins = [...state.newsPins, ...newPins].slice(-30);
        }
      }

      return next;
    }),
  fetchNetwork: async () => {
    const baseUrl = import.meta.env.VITE_GATEWAY_HTTP_URL || "http://localhost:8000";
    try {
      const response = await fetch(`${baseUrl}/map/network`);
      if (!response.ok) return;
      const data = await response.json();
      set({
        networkNodes: data.nodes ?? [],
        networkRoutes: data.routes ?? [],
        networkGeofences: data.geofences ?? [],
      });
    } catch (error) {
      console.warn("Failed to fetch /map/network:", error);
    }
  },
  fetchKpiNetwork: async () => {
    const baseUrl = import.meta.env.VITE_GATEWAY_HTTP_URL || "http://localhost:8000";
    try {
      const response = await fetch(`${baseUrl}/kpi/network`);
      if (!response.ok) return;
      const data = await response.json();
      const entities: Record<string, KpiEntity> = {};
      for (const row of data.entities ?? []) {
        const kpis: Record<string, KpiValue> = {};
        for (const [kpiName, kpiValue] of Object.entries(
          row.kpis as Record<string, { value: number; computed_at: string }>,
        )) {
          kpis[kpiName] = { value: kpiValue.value, computedAt: kpiValue.computed_at };
        }
        entities[row.entity_id] = {
          entityId: row.entity_id,
          entityType: row.entity_type,
          location: row.location ?? null,
          kpis,
        };
      }
      set({ kpiByEntity: entities });
    } catch (error) {
      console.warn("Failed to fetch /kpi/network:", error);
    }
  },
  fetchKpiDashboard: async () => {
    const baseUrl = import.meta.env.VITE_GATEWAY_HTTP_URL || "http://localhost:8000";
    try {
      const response = await fetch(`${baseUrl}/kpi/dashboard`);
      if (!response.ok) return;
      const data = await response.json();
      set({ kpiDashboard: data ?? {} });
    } catch (error) {
      console.warn("Failed to fetch /kpi/dashboard:", error);
    }
  },
  fetchKpiConfig: async () => {
    const baseUrl = import.meta.env.VITE_GATEWAY_HTTP_URL || "http://localhost:8000";
    try {
      const response = await fetch(`${baseUrl}/config/kpi-thresholds`);
      if (!response.ok) return;
      const data = await response.json();
      set({ kpiConfig: data ?? {} });
    } catch (error) {
      console.warn("Failed to fetch /config/kpi-thresholds:", error);
    }
  },
}));
