import type { AgentTrace, DebateEntry } from "../../types/agent";

interface AgentTraceOverlayProps {
  traces: AgentTrace[];
  debateHistory: DebateEntry[];
}

const AGENT_COLORS: Record<string, string> = {
  supervisor: "var(--color-agent-supervisor)",
  intelligence: "var(--color-agent-intel)",
  vision: "var(--color-agent-vision)",
  spatial: "var(--color-agent-spatial)",
  geopolitical: "var(--color-agent-geo)",
  logistics: "var(--color-agent-logistics)",
  finance: "var(--color-agent-finance)",
  synthesis: "var(--color-agent-synthesis)",
};

/**
 * Agent cognitive overlay panel — glass-box trace display.
 * Shows real-time agent reasoning and debate exchanges.
 */
export function AgentTraceOverlay({ traces, debateHistory }: AgentTraceOverlayProps) {
  return (
    <div className="glass-card animate-slide-in" id="agent-trace-overlay">
      <div className="section-header">
        <span className="section-icon">🔍</span>
        <h2>Agent Cognitive Trace</h2>
      </div>

      <div className="trace-panel">
        {traces.length === 0 && (
          <div style={{ color: "var(--color-text-muted)", fontSize: "0.8rem", padding: "var(--space-md)" }}>
            Waiting for agent activity...
          </div>
        )}

        {traces.map((trace, i) => (
          <div
            key={i}
            className="trace-entry"
            style={{ borderLeftColor: AGENT_COLORS[trace.agent] || "var(--color-border)" }}
          >
            <span className="agent-name" style={{ color: AGENT_COLORS[trace.agent] }}>
              {trace.agent}
            </span>
            <span className="trace-content">{trace.content}</span>
          </div>
        ))}

        {debateHistory.length > 0 && (
          <>
            <div className="section-header" style={{ marginTop: "var(--space-md)" }}>
              <span className="section-icon">⚔️</span>
              <h2>Adversarial Debate</h2>
            </div>
            {debateHistory.map((entry, i) => (
              <div
                key={i}
                className="trace-entry"
                style={{ borderLeftColor: AGENT_COLORS[entry.agent] }}
              >
                <span className="agent-name" style={{ color: AGENT_COLORS[entry.agent] }}>
                  Round {entry.round} — {entry.agent}
                </span>
                <span className="trace-content">{entry.position}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
