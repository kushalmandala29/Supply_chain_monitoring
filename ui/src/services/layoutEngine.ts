import type { LayoutSpec, LayoutComponent } from "../types/layout";

/**
 * Layout Engine — maps Supervisor JSON layout specs to React component names.
 * Determines which components to mount/unmount based on the incoming payload.
 */

const COMPONENT_REGISTRY: Record<string, string> = {
  sankey_topology: "SankeyFlow",
  financial_waterfall: "WaterfallChart",
  kpi_impact_cards: "ImpactCards",
  agent_cognitive_overlay: "AgentTraceOverlay",
  war_room_sliders: "ParameterSliders",
  spatial_risk_layer: "RiskMap",
};

export function resolveComponents(spec: LayoutSpec): string[] {
  return spec.components
    .map((c: LayoutComponent) => COMPONENT_REGISTRY[c.type])
    .filter(Boolean);
}

export function shouldMountComponent(spec: LayoutSpec | null, componentType: string): boolean {
  if (!spec) return true; // Default: show everything
  return spec.components.some((c: LayoutComponent) => c.type === componentType);
}
