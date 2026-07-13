import { useEffect, useState } from "react";

interface HistoryPoint {
  kpi_value: number;
  computed_at: string;
}

interface TrendSparklineProps {
  entityId: string;
  kpiName: string;
  width?: number;
  height?: number;
}

/** Fetches GET /kpi/history on demand (hover-triggered, not part of the
 * global store) and renders it as a minimal inline SVG sparkline. */
export default function TrendSparkline({ entityId, kpiName, width = 90, height = 24 }: TrendSparklineProps) {
  const [history, setHistory] = useState<HistoryPoint[] | null>(null);

  useEffect(() => {
    let live = true;
    const baseUrl = import.meta.env.VITE_GATEWAY_HTTP_URL || "http://localhost:8000";
    fetch(
      `${baseUrl}/kpi/history?entity_id=${encodeURIComponent(entityId)}&kpi_name=${encodeURIComponent(kpiName)}&limit=20`,
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (live) setHistory(data?.history ?? []);
      })
      .catch(() => {
        if (live) setHistory([]);
      });
    return () => {
      live = false;
    };
  }, [entityId, kpiName]);

  if (!history || history.length < 2) {
    return (
      <div style={{ width, height }} className="flex items-center justify-center text-[8px] text-cyan-400/30">
        no trend yet
      </div>
    );
  }

  const values = history.map((h) => h.kpi_value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const trendUp = values[values.length - 1] >= values[0];

  return (
    <svg width={width} height={height} className="overflow-visible shrink-0">
      <polyline points={points} fill="none" stroke={trendUp ? "#34d399" : "#f87171"} strokeWidth={1.5} />
    </svg>
  );
}
