import { useState } from "react";

import { KpiConfigEntry, KpiValue, useJarvisStore } from "../../../store/useStore";
import KpiPanel from "./KpiPanel";

const RING_KPIS = ["fill_rate", "inventory_accuracy", "picking_accuracy", "inventory_turnover", "backorder_rate"];
const SEVERITY_COLOR: Record<string, string> = { green: "#34d399", amber: "#f59e0b", red: "#ef4444" };

function normalizedFraction(value: number, config: KpiConfigEntry | undefined): number {
  if (!config) return 0.5;
  const { green, red } = config.thresholds;
  if (config.direction === "higher_is_better") {
    return Math.max(0, Math.min(1, value / (green || 1)));
  }
  return Math.max(0, Math.min(1, 1 - value / (red || 1)));
}

interface KpiRingProps {
  entityId: string;
  entityName: string;
  kpis: Record<string, KpiValue>;
  size?: number;
}

/** Concentric KPI rings for one facility -- fill rate, inventory accuracy,
 * picking accuracy, inventory turnover, backorder rate, each as its own
 * ring (innermost -> outermost). Hovering opens the full KpiPanel with
 * formula/threshold/trend detail. Replaces deck.gl's flat node marker with
 * a KPI-health-aware equivalent for use inside the HUD (e.g. a facility
 * list/dashboard), independent of the 3D globe's own point rendering. */
export default function KpiRing({ entityId, entityName, kpis, size = 64 }: KpiRingProps) {
  const [hovered, setHovered] = useState(false);
  const kpiConfig = useJarvisStore((s) => s.kpiConfig);

  const center = size / 2;
  const ringGap = center / (RING_KPIS.length + 1);

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <svg width={size} height={size}>
        {RING_KPIS.map((kpiName, i) => {
          const radius = ringGap * (i + 1);
          const circumference = 2 * Math.PI * radius;
          const kpi = kpis[kpiName];
          const config = kpiConfig[kpiName];
          const fraction = kpi ? normalizedFraction(kpi.value, config) : 0;
          const color = kpi ? SEVERITY_COLOR[kpi.severity ?? "green"] : "#334155";
          return (
            <circle
              key={kpiName}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeDasharray={`${circumference * fraction} ${circumference}`}
              strokeLinecap="round"
              transform={`rotate(-90 ${center} ${center})`}
              opacity={kpi ? 0.9 : 0.25}
            />
          );
        })}
      </svg>
      {hovered && (
        <div className="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-2 w-64">
          <KpiPanel entityId={entityId} entityName={entityName} kpis={kpis} kpiConfig={kpiConfig} />
        </div>
      )}
    </div>
  );
}
