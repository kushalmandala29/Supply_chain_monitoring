import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet, useSearchParams } from "react-router-dom";

import AgentConsole from "../HUD/AgentConsole";
import { InfoPopup, PopupData } from "../HUD/InfoPopup";
import IntelligencePanel from "../intelligence/IntelligencePanel";
import { useWebSocket } from "../../hooks/useWebSocket";
import { gibsSnapshotUrl } from "../../lib/nasaGibs";
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
  const mapMarker = useJarvisStore((s) => s.mapMarker);
  const explanationImageUrl = useJarvisStore((s) => s.explanationImageUrl);
  const sources = useJarvisStore((s) => s.sources);
  const lastQueryDurationMs = useJarvisStore((s) => s.lastQueryDurationMs);
  const lastIntelArticles = useJarvisStore((s) => s.lastIntelArticles);

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

  const popupCountRef = useRef(0);
  const openPopup = useCallback((popup: Omit<PopupData, "x" | "y"> & { x?: number; y?: number }) => {
    // Cascade successive popups instead of stacking them at an identical
    // position -- otherwise a second popup landing exactly on top of the
    // first reads as "nothing happened" even though the content changed.
    const stagger = (popupCountRef.current++ % 5) * 28;
    const resolved: PopupData = {
      x: Math.max(window.innerWidth / 2 - 160, 16) + stagger,
      y: 96 + stagger,
      ...popup,
    };
    setPopups((prev) => {
      const trimmed = prev.length >= 6 ? prev.slice(1) : prev;
      return [...trimmed, resolved];
    });
    setTopId(resolved.id);
  }, []);
  const closePopup = useCallback((id: string) => setPopups((prev) => prev.filter((p) => p.id !== id)), []);
  const focusPopup = useCallback((id: string) => setTopId(id), []);

  // Clear stale popups whenever a new query is submitted.
  useEffect(() => { setPopups([]); }, [queryStartedAt]);

  // Auto-surface proof the moment the final answer lands -- as *separate*
  // popups per distinct kind of evidence (picture / web sources / live news)
  // rather than one window combining everything, so genuinely different
  // proof doesn't get buried together. Each fires independently and is only
  // skipped if it has nothing to show or duplicates another popup's content.
  // All three are keyed on queryStartedAt so each fires once per query.

  // 1. Satellite picture -- generated client-side from mapMarker (set by
  // either explanation_updated.location or satellite_ready.center) rather
  // than depending on the Vision Agent specifically, so a location resolves
  // to a picture on every query/click that has one, not just the ones
  // routed to Vision.
  const lastPicturePopupKeyRef = useRef<number | null>(null);
  useEffect(() => {
    if (lastQueryDurationMs === null) return; // wait for the final answer, not mid-stream chunks
    if (queryStartedAt === null || queryStartedAt === lastPicturePopupKeyRef.current) return;
    if (!mapMarker) return;
    lastPicturePopupKeyRef.current = queryStartedAt;
    openPopup({
      id: `picture-${queryStartedAt}`,
      label: "Satellite view",
      imageUrl: gibsSnapshotUrl(mapMarker.lat, mapMarker.lon),
      imageCaption: mapMarker.label,
      sources: [],
    });
  }, [mapMarker, lastQueryDurationMs, queryStartedAt, openPopup]);

  // 2. Synthesizer's web-search sources.
  const lastSourcesPopupKeyRef = useRef<number | null>(null);
  useEffect(() => {
    if (lastQueryDurationMs === null) return;
    if (queryStartedAt === null || queryStartedAt === lastSourcesPopupKeyRef.current) return;
    if (sources.length === 0) return;
    lastSourcesPopupKeyRef.current = queryStartedAt;
    openPopup({
      id: `sources-${queryStartedAt}`,
      label: "Web sources",
      imageUrl: explanationImageUrl || undefined,
      sources,
    });
  }, [sources, explanationImageUrl, lastQueryDurationMs, queryStartedAt, openPopup]);

  // 3. Intel Agent's own per-query NewsAPI search -- a different search
  // backend/result set from the Synthesizer's sources above, so only shown
  // when it actually adds something (filters out any article whose URL is
  // already covered by the sources popup, to avoid a near-duplicate window).
  const lastIntelPopupKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!lastIntelArticles || lastIntelArticles.id === lastIntelPopupKeyRef.current) return;
    const knownUrls = new Set(sources.map((s) => s.url).filter(Boolean));
    const distinctArticles = lastIntelArticles.articles.filter((a) => !knownUrls.has(a.url));
    lastIntelPopupKeyRef.current = lastIntelArticles.id;
    if (distinctArticles.length === 0) return;
    openPopup({
      id: lastIntelArticles.id,
      label: "Live news",
      sources: distinctArticles,
    });
  }, [lastIntelArticles, sources, openPopup]);

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
