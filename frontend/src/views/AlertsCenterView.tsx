import HudPanel from "../components/HUD/HudPanel";
import AlertPulse from "../components/HUD/kpi/AlertPulse";
import { useJarvisStore } from "../store/useStore";

export default function AlertsCenterView() {
  const kpiAlerts = useJarvisStore((s) => s.kpiAlerts);
  const networkNodes = useJarvisStore((s) => s.networkNodes);
  const nameFor = (id: string) => networkNodes.find((n) => n.id === id)?.name ?? id;

  return (
    <div className="h-full w-full overflow-y-auto p-6">
      <HudPanel title="Alerts Center" subtitle={`${kpiAlerts.length} in session`} accentColor="red" className="max-w-2xl" noPad>
        <div className="divide-y divide-white/5 max-h-[70vh] overflow-y-auto">
          {kpiAlerts.length === 0 && (
            <div className="px-4 py-6 text-center text-[11px] text-cyan-300/40">No alerts yet this session.</div>
          )}
          {[...kpiAlerts].reverse().map((a) => (
            <div key={a.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <AlertPulse severity={a.severity} />
                <div className="min-w-0">
                  <div className="text-[11px] text-cyan-100 truncate">{nameFor(a.entity_id)}</div>
                  <div className="text-[9px] text-cyan-400/40 uppercase tracking-widest truncate">
                    {a.kpi.replace(/_/g, " ")} &middot; {a.current.toFixed(1)}
                    {a.threshold !== null ? ` (threshold ${a.threshold})` : ""}
                  </div>
                </div>
              </div>
              <span className="text-[9px] text-cyan-400/30 shrink-0">
                {new Date(a.receivedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          ))}
        </div>
        <div className="px-4 py-3 text-[9px] text-cyan-400/30 italic border-t border-white/5">
          Showing this session's alerts only. Persisted, filterable, and paginated alert history lands in Phase 7.
        </div>
      </HudPanel>
    </div>
  );
}
