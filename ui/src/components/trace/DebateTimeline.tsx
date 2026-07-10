import type { DebateEntry } from "../../types/agent";

interface DebateTimelineProps {
  entries: DebateEntry[];
}

/**
 * Timeline visualization of the Geopolitical ↔ Logistics adversarial debate.
 */
export function DebateTimeline({ entries }: DebateTimelineProps) {
  if (entries.length === 0) return null;

  return (
    <div className="glass-card" id="debate-timeline">
      <div className="section-header">
        <span className="section-icon">⚔️</span>
        <h2>Debate Timeline ({entries.length} rounds)</h2>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
        {entries.map((entry, i) => (
          <div key={i} style={{
            padding: "var(--space-sm) var(--space-md)",
            borderRadius: "var(--radius-md)",
            background: entry.agent === "geopolitical"
              ? "rgba(245, 158, 11, 0.08)"
              : "rgba(239, 68, 68, 0.08)",
            borderLeft: `3px solid ${entry.agent === "geopolitical"
              ? "var(--color-agent-geo)"
              : "var(--color-agent-logistics)"}`,
          }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 600, marginBottom: 4 }}>
              Round {entry.round} — {entry.agent}
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)" }}>
              {entry.position}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
