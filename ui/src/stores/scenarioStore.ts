import { create } from "zustand";

interface ScenarioState {
  activeScenario: string | null;
  parameters: {
    transit_days_delay: number;
    operational_capacity_percent: number;
    freight_cost_premium_usd: number;
  };
  isSimulating: boolean;
  setScenario: (description: string) => void;
  updateParameters: (params: Partial<ScenarioState["parameters"]>) => void;
  setSimulating: (value: boolean) => void;
  clearScenario: () => void;
}

/**
 * Zustand store for What-If scenario state.
 */
export const useScenarioStore = create<ScenarioState>((set) => ({
  activeScenario: null,
  parameters: {
    transit_days_delay: 0,
    operational_capacity_percent: 100,
    freight_cost_premium_usd: 0,
  },
  isSimulating: false,

  setScenario: (description) => set({ activeScenario: description }),

  updateParameters: (params) =>
    set((state) => ({
      parameters: { ...state.parameters, ...params },
    })),

  setSimulating: (value) => set({ isSimulating: value }),

  clearScenario: () =>
    set({
      activeScenario: null,
      parameters: {
        transit_days_delay: 0,
        operational_capacity_percent: 100,
        freight_cost_premium_usd: 0,
      },
      isSimulating: false,
    }),
}));
