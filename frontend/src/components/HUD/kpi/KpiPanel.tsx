import { KpiConfigEntry, KpiValue } from "../../../store/useStore";
import HudPanel from "../HudPanel";
import AlertPulse from "./AlertPulse";
import TrendSparkline from "./TrendSparkline";

// UI copy describing each formula -- the VALUES (thresholds, computed
// values) always come from the backend (config/settings.yaml, kpi_facts);
// nothing numeric is hardcoded here, only the human-readable label.
const FORMULA_LABEL: Record<string, string> = {
  inventory_turnover: "COGS / Average Inventory",
  inventory_accuracy: "System Inventory / Physical Inventory",
  days_on_hand: "Average Inventory / Daily COGS",
  return_rate: "Returned Orders / Total Orders",
  backorder_rate: "Backorders / Total Orders",
  fill_rate: "Orders Fulfilled / Orders Received",
  perfect_order_rate: "On Time x Complete x Damage Free x Accurate",
  order_cycle_time: "Delivered Date - Order Date",
  picking_accuracy: "Correct Picks / Total Picks",
  on_time_shipping: "On-Time Deliveries / Total Deliveries",
};

interface KpiPanelProps {
  entityId: string;
  entityName: string;
  kpis: Record<string, KpiValue>;
  kpiConfig: Record<string, KpiConfigEntry>;
}

/** Full KPI breakdown for one facility -- formula, threshold, current
 * value, trend sparkline per KPI. Reuses HudPanel for visual consistency
 * with every other panel in the HUD. */
export default function KpiPanel({ entityId, entityName, kpis, kpiConfig }: KpiPanelProps) {
  const entries = Object.entries(kpis);

  return (
    <HudPanel title={entityName} subtitle="KPI Breakdown" accentColor="cyan" noPad>
      <div className="divide-y divide-white/5 max-h-80 overflow-y-auto">
        {entries.length === 0 && (
          <div className="px-4 py-3 text-[11px] text-cyan-300/40">No KPI data yet for this facility.</div>
        )}
        {entries.map(([kpiName, kpi]) => {
          const config = kpiConfig[kpiName];
          return (
            <div key={kpiName} className="px-4 py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <AlertPulse severity={kpi.severity ?? "green"} />
                  <span className="text-[11px] font-semibold text-cyan-100 truncate capitalize">
                    {kpiName.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="text-[9px] text-cyan-400/40 font-mono truncate">
                  {FORMULA_LABEL[kpiName] ?? ""}
                </div>
                {config && (
                  <div className="text-[9px] text-cyan-400/40">
                    threshold: {config.thresholds.amber}
                    {config.direction === "higher_is_better" ? "+" : "-"}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-bold text-cyan-50">{kpi.value.toFixed(1)}</span>
                <TrendSparkline entityId={entityId} kpiName={kpiName} width={70} height={22} />
              </div>
            </div>
          );
        })}
      </div>
    </HudPanel>
  );
}
