/** What-If scenario definition. */
export interface Scenario {
  scenario_description: string;
  coordinates?: [number, number];
  parameters: ScenarioParameters;
}

/** War Room slider parameters. */
export interface ScenarioParameters {
  transit_days_delay: number;
  operational_capacity_percent: number;
  freight_cost_premium_usd: number;
}

/** Simulation result from the shadow database. */
export interface SimulationResult {
  simulation_id: string;
  scenario_label: string;
  injected_parameters: ScenarioParameters;
  computed_impacts: Record<string, unknown>;
  created_at: string;
}
