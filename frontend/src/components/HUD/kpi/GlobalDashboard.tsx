import { useJarvisStore } from "../../../store/useStore";
import HudPanel from "../HudPanel";

const TILES: { kpiName: string; label: string; suffix: string }[] = [
  { kpiName: "fill_rate", label: "Fill Rate", suffix: "%" },
  { kpiName: "perfect_order_rate", label: "Perfect Order Rate", suffix: "%" },
  { kpiName: "backorder_rate", label: "Backorder Rate", suffix: "%" },
  { kpiName: "inventory_turnover", label: "Inventory Turnover", suffix: "x" },
];

/** Platform-wide KPI rollup -- the average of every entity's latest value
 * per KPI (GET /kpi/dashboard), refreshed live as kpi.update/kpi.alert
 * WebSocket messages arrive (see useStore.ts's scheduleDashboardRefresh). */
export default function GlobalDashboard() {
  const kpiDashboard = useJarvisStore((s) => s.kpiDashboard);

  return (
    <HudPanel title="Global Dashboard" subtitle="Live" accentColor="cyan">
      <div className="grid grid-cols-2 gap-3">
        {TILES.map(({ kpiName, label, suffix }) => {
          const value = kpiDashboard[kpiName];
          return (
            <div key={kpiName} className="rounded-xl border border-white/5 px-3 py-2">
              <div className="text-[9px] uppercase tracking-widest text-cyan-400/40">{label}</div>
              <div className="text-lg font-bold text-cyan-50 font-mono">
                {value !== undefined ? `${value.toFixed(1)}${suffix}` : "--"}
              </div>
            </div>
          );
        })}
      </div>
    </HudPanel>
  );
}
