import { useState, useEffect } from "react";
import type { AgentTrace, DebateEntry } from "../types/agent";
import { useAgentStore } from "../stores/agentStore";

/**
 * Hook for consuming agent trace streams and debate history.
 */
export function useAgentStream() {
  const [traces, setTraces] = useState<AgentTrace[]>([]);
  const [debateHistory, setDebateHistory] = useState<DebateEntry[]>([]);
  const agentState = useAgentStore();

  useEffect(() => {
    setTraces(agentState.traces);
    setDebateHistory(agentState.debateHistory);
  }, [agentState.traces, agentState.debateHistory]);

  return { traces, debateHistory };
}
