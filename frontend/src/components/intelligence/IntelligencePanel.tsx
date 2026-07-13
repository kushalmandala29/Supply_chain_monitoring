import ExplanationPanel from "../HUD/ExplanationPanel";
import HudPanel from "../HUD/HudPanel";
import QueryProgressPanel from "./QueryProgressPanel";
import { useJarvisStore } from "../../store/useStore";
import { useWorkspaceStore } from "../../store/useWorkspaceStore";

/** Right-hand context panel: shows the streaming AI answer when there is
 * one, otherwise a lightweight detail card for whatever map/list entity is
 * currently selected (?entity=type:id, synced by AppShell). Sources and
 * imagery auto-popup from AppShell as soon as they're ready -- this panel
 * only ever renders the answer text itself. */
export default function IntelligencePanel() {
  const explanation = useJarvisStore((s) => s.explanation);
  const activeAgents = useJarvisStore((s) => s.activeAgents);
  const durationMs = useJarvisStore((s) => s.lastQueryDurationMs);
  const networkNodes = useJarvisStore((s) => s.networkNodes);
  const kpiByEntity = useJarvisStore((s) => s.kpiByEntity);
  const queryStartedAt = useJarvisStore((s) => s.queryStartedAt);

  const selectedEntity = useWorkspaceStore((s) => s.selectedEntity);
  const pinEntity = useWorkspaceStore((s) => s.pinEntity);
  const toggleFavorite = useWorkspaceStore((s) => s.toggleFavorite);
  const isFavorite = useWorkspaceStore((s) => s.isFavorite);

  if (explanation) {
    return (
      <ExplanationPanel
        explanation={explanation}
        activeAgents={activeAgents}
        durationMs={durationMs}
      />
    );
  }

  // Show live query progress if a query is active but explanation hasn't arrived yet
  if (queryStartedAt !== null) {
    return <QueryProgressPanel />;
  }

  if (selectedEntity) {
    const node = networkNodes.find((n) => n.id === selectedEntity.id);
    const kpis = kpiByEntity[selectedEntity.id]?.kpis;
    const favorited = isFavorite(selectedEntity.type, selectedEntity.id);

    return (
      <HudPanel
        title={node?.type ?? selectedEntity.type}
        subtitle="Selected"
        accentColor="cyan"
        className="w-[22rem]"
      >
        <div className="space-y-3">
          <div>
            <div className="text-lg font-semibold text-cyan-50">
              {node?.name ?? selectedEntity.label ?? selectedEntity.id}
            </div>
            {node?.country && (
              <div className="text-[10px] text-cyan-400/40 uppercase tracking-widest mt-0.5">{node.country}</div>
            )}
          </div>

          {kpis && Object.keys(kpis).length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(kpis).map(([name, kpi]) => (
                <div key={name} className="rounded-lg border border-white/5 px-2.5 py-1.5">
                  <div className="text-[8px] uppercase tracking-widest text-cyan-400/40 truncate">
                    {name.replace(/_/g, " ")}
                  </div>
                  <div className="text-sm font-bold text-cyan-50 font-mono">{kpi.value.toFixed(1)}</div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => toggleFavorite(selectedEntity.type, selectedEntity.id)}
              className={`flex-1 rounded-lg px-2.5 py-1.5 text-[10px] uppercase tracking-widest border transition-colors
                ${favorited
                  ? "border-amber-400/40 bg-amber-400/10 text-amber-300"
                  : "border-white/10 text-cyan-300/60 hover:text-cyan-100 hover:border-cyan-400/30"}`}
            >
              {favorited ? "★ Favorited" : "☆ Favorite"}
            </button>
            <button
              type="button"
              onClick={() =>
                pinEntity({
                  id: selectedEntity.id,
                  type: selectedEntity.type,
                  label: node?.name ?? selectedEntity.id,
                  pinnedAt: Date.now(),
                })
              }
              className="flex-1 rounded-lg px-2.5 py-1.5 text-[10px] uppercase tracking-widest border border-white/10
                         text-cyan-300/60 hover:text-cyan-100 hover:border-cyan-400/30 transition-colors"
            >
              📌 Pin
            </button>
          </div>
        </div>
      </HudPanel>
    );
  }

  return (
    <HudPanel title="Intelligence Panel" subtitle="Idle" accentColor="cyan" className="w-[22rem]">
      <p className="text-[11px] text-cyan-300/40 leading-relaxed">
        Ask a question or select a facility, route, or risk zone on the map to see live details here.
      </p>
    </HudPanel>
  );
}
