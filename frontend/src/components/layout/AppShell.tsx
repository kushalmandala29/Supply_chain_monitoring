import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet, useSearchParams } from "react-router-dom";

import AgentConsole from "../HUD/AgentConsole";
import { InfoPopup, PopupData } from "../HUD/InfoPopup";
import IntelligencePanel from "../intelligence/IntelligencePanel";
import { useWebSocket } from "../../hooks/useWebSocket";
import { useJarvisStore } from "../../store/useStore";
import { SelectedEntityType, useWorkspaceStore } from "../../store/useWorkspaceStore";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

/** Composition root for the redesigned app: persistent Sidebar/Topbar/
 * Intelligence Panel shell wrapping whichever view is routed into <Outlet/>.
 * Owns the single WebSocket connection, the network/KPI bootstrap fetches,
 * and the ?entity=type:id <-> selectedEntity URL sync -- all moved here
 * verbatim from the old single-page App.tsx. */
export default function AppShell() {
  useWebSocket();

  const fetchNetwork = useJarvisStore((s) => s.fetchNetwork);
  const fetchKpiNetwork = useJarvisStore((s) => s.fetchKpiNetwork);
  const fetchKpiDashboard = useJarvisStore((s) => s.fetchKpiDashboard);
  const fetchKpiConfig = useJarvisStore((s) => s.fetchKpiConfig);
  const queryStartedAt = useJarvisStore((s) => s.queryStartedAt);
  const lastSatelliteImagery = useJarvisStore((s) => s.lastSatelliteImagery);
  const sources = useJarvisStore((s) => s.sources);
  const lastQueryDurationMs = useJarvisStore((s) => s.lastQueryDurationMs);

  useEffect(() => { fetchNetwork(); }, [fetchNetwork]);
  useEffect(() => { fetchKpiNetwork(); }, [fetchKpiNetwork]);
  useEffect(() => { fetchKpiDashboard(); }, [fetchKpiDashboard]);
  useEffect(() => { fetchKpiConfig(); }, [fetchKpiConfig]);

  const [searchParams, setSearchParams] = useSearchParams();
  const selectedEntity = useWorkspaceStore((s) => s.selectedEntity);
  const setSelectedEntity = useWorkspaceStore((s) => s.setSelectedEntity);
  const hydratedRef = useRef(false);

  // URL -> store, once on initial mount (deep-link support).
  useEffect(() => {
    const entityParam = searchParams.get("entity");
    if (entityParam) {
      const [type, id] = entityParam.split(":");
      if (type && id) setSelectedEntity({ id, type: type as SelectedEntityType });
    }
    hydratedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // store -> URL, whenever the selection changes after hydration.
  useEffect(() => {
    if (!hydratedRef.current) return;
    const next = new URLSearchParams(searchParams);
    if (selectedEntity) next.set("entity", `${selectedEntity.type}:${selectedEntity.id}`);
    else next.delete("entity");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEntity]);

  // Floating "intel detail" popups spawned by clicking sentences inside
  // ExplanationPanel (see IntelligencePanel -> ExplanationPanel).
  const [popups, setPopups] = useState<PopupData[]>([]);
  const [topId, setTopId] = useState<string | null>(null);

  const openPopup = useCallback((popup: PopupData) => {
    setPopups((prev) => {
      const trimmed = prev.length >= 6 ? prev.slice(1) : prev;
      return [...trimmed, popup];
    });
    setTopId(popup.id);
  }, []);
  const closePopup = useCallback((id: string) => setPopups((prev) => prev.filter((p) => p.id !== id)), []);
  const focusPopup = useCallback((id: string) => setTopId(id), []);

  // Clear stale popups whenever a new query is submitted.
  useEffect(() => { setPopups([]); }, [queryStartedAt]);

  // Auto-surface imagery the moment the Vision Agent resolves it -- no click
  // required. Keyed on lastSatelliteImagery.id so this only fires once per
  // arrival, not on every unrelated re-render.
  const lastImageryIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!lastSatelliteImagery || lastSatelliteImagery.id === lastImageryIdRef.current) return;
    lastImageryIdRef.current = lastSatelliteImagery.id;
    openPopup({
      id: lastSatelliteImagery.id,
      imageUrl: lastSatelliteImagery.url,
      imageCaption: lastSatelliteImagery.label,
      sources: [],
      x: Math.max(window.innerWidth / 2 - 160, 16),
      y: 96,
    });
  }, [lastSatelliteImagery, openPopup]);

  // Auto-surface sources the moment the final answer lands -- proof (article/
  // video links, resolved via SourceCard's favicon/YouTube-thumbnail
  // detection) shouldn't require clicking a sentence to see. Keyed on
  // queryStartedAt so each query only pops its sources once, not on every
  // unrelated re-render, and skipped entirely if the answer came back with
  // no sources to show.
  const lastSourcesPopupKeyRef = useRef<number | null>(null);
  useEffect(() => {
    if (lastQueryDurationMs === null || sources.length === 0) return;
    if (queryStartedAt === null || queryStartedAt === lastSourcesPopupKeyRef.current) return;
    lastSourcesPopupKeyRef.current = queryStartedAt;
    openPopup({
      id: `sources-${queryStartedAt}`,
      sources,
      x: Math.max(window.innerWidth / 2 - 160, 16),
      y: 360,
    });
  }, [sources, lastQueryDurationMs, queryStartedAt, openPopup]);

  return (
    <div className="h-full w-full flex overflow-hidden scanlines bg-[#03060f]">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <div className="flex-1 relative min-h-0">
          <Outlet />

          {popups.map((popup, i) => (
            <InfoPopup
              key={popup.id}
              popup={popup}
              onClose={closePopup}
              onFocus={focusPopup}
              zIndex={200 + (popup.id === topId ? popups.length : i)}
            />
          ))}

          <AgentConsole />
        </div>
      </div>

      <div className="w-[24rem] shrink-0 border-l border-cyan-400/10 glass overflow-y-auto p-4">
        <IntelligencePanel />
      </div>
    </div>
  );
}
