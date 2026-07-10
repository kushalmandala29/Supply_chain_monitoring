/** Agent trace entry from real-time stream. */
export interface AgentTrace {
  agent: string;
  content: string;
  timestamp?: string;
}

/** Debate entry from the Geopolitical ↔ Logistics adversarial loop. */
export interface DebateEntry {
  round: number;
  agent: string;
  position: string;
  timestamp?: string;
}

/** Agent status information. */
export interface AgentStatus {
  name: string;
  model: string;
  status: "idle" | "active" | "complete" | "error";
  lastActive?: string;
}

/** Agent roster (all 8 agents). */
export type AgentName =
  | "supervisor"
  | "intelligence"
  | "vision"
  | "spatial"
  | "geopolitical"
  | "logistics"
  | "finance"
  | "synthesis";
