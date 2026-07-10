import { useState } from "react";

interface ScenarioPanelProps {
  onSubmit: (scenario: { scenario_description: string; coordinates?: number[] }) => void;
}

/**
 * Scenario injection panel for What-If simulations.
 */
export function ScenarioPanel({ onSubmit }: ScenarioPanelProps) {
  const [description, setDescription] = useState("");

  const PRESETS = [
    { label: "Malacca Strait Shutdown (30 days)", desc: "Simulate 30-day shutdown of Malacca Strait" },
    { label: "Suez Canal Blockage (14 days)", desc: "Simulate 14-day blockage of Suez Canal" },
    { label: "Port Shanghai Lockdown", desc: "Simulate indefinite lockdown of Port of Shanghai" },
    { label: "Red Sea Crisis Escalation", desc: "Simulate escalation of Red Sea shipping attacks" },
  ];

  return (
    <div className="glass-card animate-fade-in" id="scenario-panel">
      <div className="section-header">
        <span className="section-icon">🔮</span>
        <h2>Scenario Injection</h2>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-sm)", marginBottom: "var(--space-md)" }}>
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            onClick={() => setDescription(preset.desc)}
            style={{
              padding: "6px 12px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border)",
              background: "var(--color-bg-glass)",
              color: "var(--color-text-secondary)",
              fontSize: "0.75rem",
              cursor: "pointer",
              transition: "all var(--transition-fast)",
            }}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <textarea
        id="scenario-input"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Describe a hypothetical supply chain disruption scenario..."
        style={{
          width: "100%",
          minHeight: 80,
          padding: "var(--space-md)",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--color-border)",
          background: "var(--color-bg-tertiary)",
          color: "var(--color-text-primary)",
          fontFamily: "var(--font-sans)",
          fontSize: "0.85rem",
          resize: "vertical",
          outline: "none",
        }}
      />

      <button
        id="scenario-submit"
        onClick={() => {
          if (description.trim()) {
            onSubmit({ scenario_description: description });
            setDescription("");
          }
        }}
        style={{
          marginTop: "var(--space-md)",
          padding: "10px 24px",
          borderRadius: "var(--radius-md)",
          border: "none",
          background: "var(--gradient-primary)",
          color: "white",
          fontWeight: 600,
          fontSize: "0.85rem",
          cursor: "pointer",
          transition: "all var(--transition-fast)",
        }}
      >
        🚀 Run Simulation
      </button>
    </div>
  );
}
