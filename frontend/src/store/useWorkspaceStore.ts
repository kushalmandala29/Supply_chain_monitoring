import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SelectedEntityType = "facility" | "route" | "geofence" | "alert";

export interface SelectedEntity {
  id: string;
  type: SelectedEntityType;
  label?: string;
}

export interface PinnedEntity {
  id: string;
  type: SelectedEntityType;
  label: string;
  pinnedAt: number;
  investigationId?: string;
}

export interface Investigation {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  pinnedEntityIds: string[];
  savedQueries: string[];
  replayWindow: { startedAt: number; endedAt: number } | null;
}

export interface SearchHistoryEntry {
  id: string;
  query: string;
  askedAt: number;
}

export interface MapLayerToggles {
  weather: boolean;
  satellite: boolean;
  commodityHeatmap: boolean;
  routes: boolean;
  geofences: boolean;
  alerts: boolean;
  clusters: boolean;
}

export interface AlertFilters {
  severity: Array<"green" | "amber" | "red">;
  entityType: string[];
}

function compositeId(type: SelectedEntityType, id: string): string {
  return `${type}:${id}`;
}

interface WorkspaceState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  selectedEntity: SelectedEntity | null;
  setSelectedEntity: (entity: SelectedEntity | null) => void;

  favoriteEntityIds: string[];
  toggleFavorite: (type: SelectedEntityType, id: string) => void;
  isFavorite: (type: SelectedEntityType, id: string) => boolean;

  pinnedEntities: PinnedEntity[];
  pinEntity: (entity: PinnedEntity) => void;
  unpinEntity: (type: SelectedEntityType, id: string) => void;

  searchHistory: SearchHistoryEntry[];
  addSearchHistory: (query: string) => void;

  investigations: Investigation[];
  activeInvestigationId: string | null;
  setActiveInvestigationId: (id: string | null) => void;
  createInvestigation: (name: string) => string;
  addPinToInvestigation: (investigationId: string, entity: PinnedEntity) => void;

  mapLayers: MapLayerToggles;
  toggleMapLayer: (layer: keyof MapLayerToggles) => void;

  timelineMode: "live" | "playback";
  timelineCursor: number | null;
  timelineRange: { start: number; end: number } | null;
  setTimelineMode: (mode: "live" | "playback") => void;

  alertFilters: AlertFilters;
  setAlertFilters: (filters: Partial<AlertFilters>) => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      selectedEntity: null,
      setSelectedEntity: (entity) => set({ selectedEntity: entity }),

      favoriteEntityIds: [],
      toggleFavorite: (type, id) => {
        const key = compositeId(type, id);
        set((s) => ({
          favoriteEntityIds: s.favoriteEntityIds.includes(key)
            ? s.favoriteEntityIds.filter((f) => f !== key)
            : [...s.favoriteEntityIds, key],
        }));
      },
      isFavorite: (type, id) => get().favoriteEntityIds.includes(compositeId(type, id)),

      pinnedEntities: [],
      pinEntity: (entity) =>
        set((s) => ({
          pinnedEntities: s.pinnedEntities.some((p) => p.type === entity.type && p.id === entity.id)
            ? s.pinnedEntities
            : [...s.pinnedEntities, entity],
        })),
      unpinEntity: (type, id) =>
        set((s) => ({
          pinnedEntities: s.pinnedEntities.filter((p) => !(p.type === type && p.id === id)),
        })),

      searchHistory: [],
      addSearchHistory: (query) =>
        set((s) => ({
          searchHistory: [
            { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, query, askedAt: Date.now() },
            ...s.searchHistory.filter((h) => h.query !== query),
          ].slice(0, 20),
        })),

      investigations: [],
      activeInvestigationId: null,
      setActiveInvestigationId: (id) => set({ activeInvestigationId: id }),
      createInvestigation: (name) => {
        const id = `inv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const investigation: Investigation = {
          id,
          name,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          pinnedEntityIds: [],
          savedQueries: [],
          replayWindow: null,
        };
        set((s) => ({ investigations: [...s.investigations, investigation] }));
        return id;
      },
      addPinToInvestigation: (investigationId, entity) =>
        set((s) => ({
          pinnedEntities: s.pinnedEntities.some((p) => p.type === entity.type && p.id === entity.id)
            ? s.pinnedEntities
            : [...s.pinnedEntities, { ...entity, investigationId }],
          investigations: s.investigations.map((inv) =>
            inv.id === investigationId
              ? {
                  ...inv,
                  pinnedEntityIds: inv.pinnedEntityIds.includes(entity.id)
                    ? inv.pinnedEntityIds
                    : [...inv.pinnedEntityIds, entity.id],
                  updatedAt: Date.now(),
                }
              : inv,
          ),
        })),

      mapLayers: {
        weather: false,
        satellite: false,
        commodityHeatmap: false,
        routes: true,
        geofences: true,
        alerts: true,
        clusters: true,
      },
      toggleMapLayer: (layer) =>
        set((s) => ({ mapLayers: { ...s.mapLayers, [layer]: !s.mapLayers[layer] } })),

      timelineMode: "live",
      timelineCursor: null,
      timelineRange: null,
      setTimelineMode: (mode) => set({ timelineMode: mode }),

      alertFilters: { severity: ["green", "amber", "red"], entityType: [] },
      setAlertFilters: (filters) => set((s) => ({ alertFilters: { ...s.alertFilters, ...filters } })),
    }),
    {
      name: "jarvis-workspace",
      partialize: (s) => ({
        sidebarCollapsed: s.sidebarCollapsed,
        favoriteEntityIds: s.favoriteEntityIds,
        pinnedEntities: s.pinnedEntities,
        searchHistory: s.searchHistory,
        investigations: s.investigations,
        mapLayers: s.mapLayers,
      }),
    },
  ),
);
