/**
 * Live cognitive token stream viewer.
 * Displays real-time text generation from active agents.
 */
export function CognitiveStream() {
  return (
    <div className="glass-card" id="cognitive-stream">
      <div className="section-header">
        <span className="section-icon">💭</span>
        <h2>Live Agent Stream</h2>
      </div>
      <div className="trace-panel">
        <div style={{ color: "var(--color-text-muted)", fontSize: "0.8rem" }}>
          No active agent stream. Submit a query to begin analysis.
        </div>
      </div>
    </div>
  );
}
