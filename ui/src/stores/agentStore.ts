import { create } from "zustand";
import type { AgentTrace, DebateEntry } from "../types/agent";

interface AgentState {
  traces: AgentTrace[];
  debateHistory: DebateEntry[];
  activeAgents: string[];
  addTrace: (trace: AgentTrace) => void;
  addDebateEntry: (entry: DebateEntry) => void;
  setActiveAgents: (agents: string[]) => void;
  clearTraces: () => void;
}

/**
 * Zustand store for agent state management.
 */
export const useAgentStore = create<AgentState>((set) => ({
  traces: [],
  debateHistory: [],
  activeAgents: [],

  addTrace: (trace) =>
    set((state) => ({
      traces: [...state.traces, trace].slice(-100), // Keep last 100
    })),

  addDebateEntry: (entry) =>
    set((state) => ({
      debateHistory: [...state.debateHistory, entry],
    })),

  setActiveAgents: (agents) => set({ activeAgents: agents }),

  clearTraces: () => set({ traces: [], debateHistory: [] }),
}));
