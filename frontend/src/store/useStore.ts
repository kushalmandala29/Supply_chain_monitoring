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
  | "explanation_updated";

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
  sendQuery: (query: string) => void;
  setConnectionStatus: (status: JarvisState["connectionStatus"]) => void;
  setSendQuery: (sendQuery: (query: string) => void) => void;
  ingest: (stream: StreamKey, payload: Record<string, unknown>) => void;
  fetchNetwork: () => Promise<void>;
}

export const useJarvisStore = create<JarvisState>((set) => ({
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
}));
