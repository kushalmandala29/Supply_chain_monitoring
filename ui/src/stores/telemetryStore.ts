import { create } from "zustand";

interface FinancialImpact {
  working_capital_impact_usd: number;
  inventory_carrying_cost_usd: number;
  gross_margin_delta_percent: number;
  freight_premium_usd: number;
  total_estimated_loss_usd: number;
  waterfall_breakdown: { label: string; value: number; type: string }[];
}

interface TelemetryState {
  financialImpact: FinancialImpact | null;
  riskSummary: string;
  confidenceScore: number;
  setFinancialImpact: (data: FinancialImpact) => void;
  setRiskSummary: (summary: string) => void;
  setConfidenceScore: (score: number) => void;
}

/**
 * Zustand store for live telemetry data from the backend.
 */
export const useTelemetryStore = create<TelemetryState>((set) => ({
  financialImpact: null,
  riskSummary: "",
  confidenceScore: 0,

  setFinancialImpact: (data) => set({ financialImpact: data }),
  setRiskSummary: (summary) => set({ riskSummary: summary }),
  setConfidenceScore: (score) => set({ confidenceScore: score }),
}));
