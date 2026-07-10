/**
 * What-If execution controls component.
 * Manages the simulation lifecycle and status display.
 */
export function WhatIfControls() {
  return (
    <div className="glass-card" id="whatif-controls">
      <div className="section-header">
        <span className="section-icon">⚡</span>
        <h2>Simulation Status</h2>
      </div>
      <div style={{ color: "var(--color-text-secondary)", fontSize: "0.85rem" }}>
        <p>No active simulation. Use the Scenario Panel to inject a disruption event.</p>
      </div>
    </div>
  );
}
