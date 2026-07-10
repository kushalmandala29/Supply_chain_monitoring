import { GlassCard } from "../common/GlassCard";
import { AnimatedCounter } from "../common/AnimatedCounter";
import { useTelemetryStore } from "../../stores/telemetryStore";

/**
 * Financial KPI impact summary cards.
 */
export function ImpactCards() {
  const financial = useTelemetryStore((s) => s.financialImpact);

  const cards = [
    {
      label: "Working Capital Impact",
      value: financial?.working_capital_impact_usd || 245000,
      prefix: "$",
      color: "var(--color-danger)",
    },
    {
      label: "Inventory Carrying Cost",
      value: financial?.inventory_carrying_cost_usd || 42000,
      prefix: "$",
      color: "var(--color-warning)",
    },
    {
      label: "Freight Premium",
      value: financial?.freight_premium_usd || 95000,
      prefix: "$",
      color: "var(--color-agent-logistics)",
    },
    {
      label: "Margin Delta",
      value: financial?.gross_margin_delta_percent || -3.2,
      suffix: "%",
      color: "var(--color-agent-synthesis)",
    },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "var(--space-md)" }} id="impact-cards">
      {cards.map((card) => (
        <GlassCard key={card.label}>
          <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginBottom: 4 }}>
            {card.label}
          </div>
          <div style={{ fontSize: "1.4rem", fontWeight: 700, color: card.color, fontFamily: "var(--font-mono)" }}>
            {card.prefix}
            <AnimatedCounter value={Math.abs(card.value)} />
            {card.suffix}
          </div>
        </GlassCard>
      ))}
    </div>
  );
}
