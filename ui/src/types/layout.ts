/** Dynamic layout specification dispatched by the Supervisor Agent. */
export interface LayoutSpec {
  layout_version: string;
  trigger_context: string;
  grid: {
    columns: number;
    gap: string;
  };
  components: LayoutComponent[];
}

/** Individual component in the layout specification. */
export interface LayoutComponent {
  id: string;
  type: string;
  span: number;
  row: number;
  props?: Record<string, unknown>;
}

/** Supported component types for the dynamic viewport. */
export type ComponentType =
  | "sankey_topology"
  | "financial_waterfall"
  | "kpi_impact_cards"
  | "agent_cognitive_overlay"
  | "war_room_sliders"
  | "spatial_risk_layer";
