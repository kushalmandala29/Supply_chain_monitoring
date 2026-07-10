/**
 * Live KPI metric counters panel.
 */
export function KPIMetrics() {
  return (
    <div className="glass-card" id="kpi-metrics">
      <div className="section-header">
        <span className="section-icon">📈</span>
        <h2>Live KPI Metrics</h2>
      </div>
      <div style={{ color: "var(--color-text-secondary)", fontSize: "0.85rem" }}>
        KPI metrics will populate after agent analysis completes.
      </div>
    </div>
  );
}
