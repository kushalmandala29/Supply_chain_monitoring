import { useState } from "react";
import { useJarvisStore } from "../../store/useStore";

const STREAM_META: Record<string, { label: string; color: string; dot: string }> = {
  agent_status:      { label: "AGENT",     color: "text-cyan-300",    dot: "bg-cyan-400" },
  news_ingested:     { label: "INTEL",     color: "text-violet-300",  dot: "bg-violet-400" },
  weather_updated:   { label: "WEATHER",   color: "text-sky-300",     dot: "bg-sky-400" },
  commodity_updated: { label: "COMMODITY", color: "text-amber-300",   dot: "bg-amber-400" },
  satellite_ready:   { label: "VISION",    color: "text-teal-300",    dot: "bg-teal-400" },
  route_recomputed:  { label: "LOGISTICS", color: "text-indigo-300",  dot: "bg-indigo-400" },
  risk_detected:     { label: "RISK",      color: "text-red-300",     dot: "bg-red-400" },
  explanation_updated:{ label:"SYNTHESIS", color: "text-emerald-300", dot: "bg-emerald-400" },
  query_router:      { label: "ROUTER",    color: "text-fuchsia-300", dot: "bg-fuchsia-400" },
};

export default function QueryProgressPanel() {
  const activeQuery = useJarvisStore((s) => s.activeQuery);
  const activeAgents = useJarvisStore((s) => s.activeAgents);
  const trace = useJarvisStore((s) => s.trace);
  const [isExpanded, setIsExpanded] = useState(false);

  const agentStatuses = activeAgents.map((agent) => {
    const statusEvents = trace.filter(
      (t) => t.stream === "agent_status" && t.payload.agent === agent
    );
    const latestEvent = statusEvents.length > 0 ? statusEvents[statusEvents.length - 1] : null;
    
    return {
      agent,
      status: latestEvent?.payload?.status as string || "waiting",
      detail: latestEvent?.payload?.detail as string || "",
      elapsedMs: latestEvent?.payload?.elapsed_ms as number | undefined,
    };
  });

  return (
    <div className="w-[22rem]">
      {/* Target Objective above the box */}
      <div className="mb-4">
        <div className="text-[10px] uppercase tracking-widest text-cyan-400/50 mb-1.5 font-bold">Target Objective</div>
        <div className="text-sm text-cyan-50 font-medium leading-relaxed bg-white/5 border border-white/10 rounded-lg p-3">
          "{activeQuery || "Processing..."}"
        </div>
      </div>

      {/* Claude-style Thinking Box */}
      <div className="bg-neutral-800/90 shadow-xl border border-white/10 rounded-xl overflow-hidden transition-all duration-300">
        <button 
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full border-2 border-neutral-400 border-t-neutral-100 animate-spin"></div>
            <span className="text-sm font-medium text-neutral-200 tracking-wide">Orchestrating agents...</span>
          </div>
          <svg
            className={`w-4 h-4 text-neutral-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isExpanded && (
          <div className="px-4 pb-4 pt-1 bg-neutral-900/50 border-t border-white/5">
            <div className="space-y-3 mt-3">
              {agentStatuses.map(({ agent, status, detail, elapsedMs }) => {
                const meta = Object.values(STREAM_META).find(m => m.label === agent.toUpperCase());
                const isCompleted = status === "completed";
                const isError = status === "error";
                const isWaiting = status === "waiting";
                
                return (
                  <div key={agent} className="flex flex-col gap-1">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="shrink-0 mt-0.5">
                          {isCompleted ? (
                            <div className="text-emerald-500 text-xs font-bold">✓</div>
                          ) : isError ? (
                            <div className="text-red-500 text-xs font-bold">✗</div>
                          ) : isWaiting ? (
                            <div className="text-neutral-500 text-xs font-bold">-</div>
                          ) : (
                            <div className="w-2.5 h-2.5 rounded-full border border-neutral-400 border-t-neutral-100 animate-spin"></div>
                          )}
                        </div>
                        <span className={`text-xs font-semibold tracking-wider uppercase ${meta?.color || 'text-cyan-300'}`}>
                          {agent}
                        </span>
                      </div>
                      {elapsedMs && <span className="text-[10px] text-neutral-500">{elapsedMs}ms</span>}
                    </div>
                    
                    <div className="text-[10px] text-neutral-400 pl-4">
                      {isError ? detail || "Agent failed." : 
                       isCompleted ? "Analysis complete." : 
                       isWaiting ? "Awaiting activation..." : 
                       detail || "Running analysis..."}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
