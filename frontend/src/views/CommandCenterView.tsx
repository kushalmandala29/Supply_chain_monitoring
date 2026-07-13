import GlobalDashboard from "../components/HUD/kpi/GlobalDashboard";
import HudPanel from "../components/HUD/HudPanel";
import { useJarvisStore } from "../store/useStore";

export default function CommandCenterView() {
  const kpiAlerts = useJarvisStore((s) => s.kpiAlerts);
  const trace = useJarvisStore((s) => s.trace);
  const recentAlerts = kpiAlerts.slice(-5).reverse();

  return (
    <div className="h-full w-full overflow-y-auto p-6 space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-5xl">
        <GlobalDashboard />

        <HudPanel title="Critical Alerts" subtitle={`${kpiAlerts.length} total`} accentColor="red">
          {recentAlerts.length === 0 ? (
            <p className="text-[11px] text-cyan-300/40">No active alerts.</p>
          ) : (
            <div className="space-y-1.5">
              {recentAlerts.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-lg border border-white/5 px-2.5 py-1.5">
                  <div className="min-w-0">
                    <div className="text-[11px] text-cyan-100 truncate">{a.entity_id}</div>
                    <div className="text-[9px] text-cyan-400/40 uppercase tracking-widest">{a.kpi.replace(/_/g, " ")}</div>
                  </div>
                  <span
                    className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full shrink-0
                      ${a.severity === "red" ? "text-red-300 bg-red-400/10" : "text-amber-300 bg-amber-400/10"}`}
                  >
                    {a.severity}
                  </span>
                </div>
              ))}
            </div>
          )}
        </HudPanel>

        <HudPanel title="Trending Events" subtitle="Live agent feed" accentColor="cyan" className="lg:col-span-2">
          {trace.length === 0 ? (
            <p className="text-[11px] text-cyan-300/40">Awaiting agent activity.</p>
          ) : (
            <div className="space-y-1">
              {trace.slice(-6).reverse().map((t) => (
                <div key={t.id} className="text-[10px] text-cyan-300/50 font-mono truncate">
                  {t.stream} &middot; {new Date(t.receivedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              ))}
            </div>
          )}
        </HudPanel>
      </div>
    </div>
  );
}
