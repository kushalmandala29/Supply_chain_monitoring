import { useEffect, useRef } from "react";
import { AgentTraceEntry, useJarvisStore } from "../../store/useStore";

/* ── Stream → badge config ──────────────────────────────────── */
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

const STATUS_STYLE: Record<string, string> = {
  started:   "text-amber-300",
  completed: "text-emerald-300",
  error:     "text-red-400",
};

function AgentStatusRow({ entry }: { entry: AgentTraceEntry }) {
  const agent  = String(entry.payload.agent  ?? "agent").toUpperCase();
  const status = String(entry.payload.status ?? "");
  const styleClass = STATUS_STYLE[status] ?? "text-cyan-300";
  const ms   = typeof entry.payload.elapsed_ms === "number" ? entry.payload.elapsed_ms : null;
  const detail = entry.payload.detail ? String(entry.payload.detail) : null;

  const icon = status === "completed" ? "✓" : status === "error" ? "✗" : "…";

  return (
    <div className="flex items-start gap-2">
      <span className={`mt-0.5 text-[10px] font-bold shrink-0 ${styleClass}`}>{icon}</span>
      <div className="min-w-0 flex-1">
        <span className="text-cyan-100 font-medium">{agent}</span>
        <span className={`ml-1.5 text-[10px] uppercase tracking-widest ${styleClass}`}>{status}</span>
        {ms !== null && (
          <span className="ml-1.5 text-[9px] text-cyan-400/40">{ms}ms</span>
        )}
        {detail && (
          <div className="mt-0.5 text-[10px] text-cyan-400/50 truncate">{detail}</div>
        )}
      </div>
    </div>
  );
}

function GenericRow({ entry }: { entry: AgentTraceEntry }) {
  const raw = JSON.stringify(entry.payload);
  const truncated = raw.length > 140 ? raw.slice(0, 140) + "…" : raw;
  return (
    <div className="text-[10px] text-cyan-300/60 truncate">{truncated}</div>
  );
}

function TraceRow({ entry }: { entry: AgentTraceEntry }) {
  const meta = STREAM_META[entry.stream];
  return (
    <div className="slide-up flex gap-2.5 py-1.5 border-b border-white/4 last:border-0">
      {/* Badge */}
      <div className="flex items-start pt-0.5 shrink-0 gap-1">
        <span className={`w-1 h-1 rounded-full mt-1 shrink-0 ${meta?.dot ?? "bg-cyan-400"}`} />
        <span className={`text-[9px] font-mono uppercase tracking-widest w-16 shrink-0 ${meta?.color ?? "text-cyan-300"}`}>
          {meta?.label ?? entry.stream}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 text-[11px] font-mono leading-relaxed text-cyan-100/80">
        {entry.stream === "agent_status"
          ? <AgentStatusRow entry={entry} />
          : <GenericRow entry={entry} />
        }
      </div>

      {/* Timestamp */}
      <div className="text-[9px] text-cyan-400/25 shrink-0 pt-0.5">
        {new Date(entry.receivedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </div>
    </div>
  );
}

export default function AgentConsole() {
  const trace = useJarvisStore((s) => s.trace);
  const bottomRef = useRef<HTMLDivElement>(null);

  /* Auto-scroll to the bottom on new entries */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [trace.length]);

  return (
    <div className="absolute bottom-8 left-4 w-[22rem] flex flex-col glass rounded-2xl border border-cyan-400/15 overflow-hidden"
         style={{ maxHeight: "min(340px, 42vh)" }}>

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 pulse-dot" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-400">
            Agent Trace
          </span>
        </div>
        <span className="text-[9px] font-mono text-cyan-400/35">
          {trace.length} event{trace.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Scrollable trace list */}
      <div className="overflow-y-auto flex-1 px-3 py-1">
        {trace.length === 0 && (
          <div className="py-6 text-center">
            <div className="text-[10px] text-cyan-500/30 uppercase tracking-widest">
              Awaiting agent activity
              <span className="blink ml-0.5">_</span>
            </div>
          </div>
        )}
        {trace.map((entry) => (
          <TraceRow key={entry.id} entry={entry} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
