import { FormEvent, useEffect, useRef, useState } from "react";

import AgentConsole from "./components/HUD/AgentConsole";
import HudPanel from "./components/HUD/HudPanel";
import WorldMap from "./components/Map/WorldMap";
import { useWebSocket } from "./hooks/useWebSocket";
import { useJarvisStore } from "./store/useStore";

/* ── Connection status indicator ──────────────────────────────── */
function ConnectionPill({ status }: { status: "connecting" | "open" | "closed" }) {
  const cfg = {
    connecting: { dot: "bg-amber-400",   label: "CONNECTING", text: "text-amber-300" },
    open:       { dot: "bg-emerald-400", label: "LIVE",        text: "text-emerald-300" },
    closed:     { dot: "bg-red-400",     label: "OFFLINE",     text: "text-red-300" },
  }[status];

  return (
    <div className="flex items-center gap-1.5 glass rounded-full px-3 py-1.5 border border-white/8">
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${status === "open" ? "pulse-dot" : ""}`} />
      <span className={`text-[10px] font-semibold tracking-widest uppercase ${cfg.text}`}>
        {cfg.label}
      </span>
    </div>
  );
}

/* ── Explanation panel formatted into sections ─────────────────── */
function ExplanationPanel({
  explanation,
  sources,
  activeAgents,
  durationMs,
}: {
  explanation: string;
  sources: { title?: string; url?: string }[];
  activeAgents: string[];
  durationMs: number | null;
}) {
  /* Split the free-text into labelled sections if possible */
  const sections = parseSections(explanation);
  const hasStructure = sections.length > 1;

  return (
    <HudPanel
      title="Supervisor"
      subtitle={durationMs !== null ? `${(durationMs / 1000).toFixed(1)}s` : undefined}
      accentColor="cyan"
      className="w-[26rem] max-h-[80vh] flex flex-col"
    >
      {/* Agent chips */}
      {activeAgents.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {activeAgents.map((a) => (
            <span
              key={a}
              className="text-[9px] font-mono uppercase tracking-widest border border-cyan-400/20
                         bg-cyan-400/5 text-cyan-300/70 rounded-full px-2 py-0.5"
            >
              {a}
            </span>
          ))}
        </div>
      )}

      {/* Explanation body */}
      <div className="overflow-y-auto flex-1 space-y-3 text-sm leading-relaxed pr-1">
        {hasStructure ? (
          sections.map(({ heading, body }, i) => (
            <div key={i}>
              {heading && (
                <div className="text-[10px] font-semibold uppercase tracking-widest text-cyan-400/70 mb-1">
                  {heading}
                </div>
              )}
              <p className="text-cyan-100/85 text-[13px]">{body}</p>
            </div>
          ))
        ) : (
          <p className="text-cyan-100/85 text-[13px]">{explanation}</p>
        )}
      </div>

      {/* Sources */}
      {sources.length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/6">
          <div className="text-[9px] font-semibold uppercase tracking-widest text-cyan-400/40 mb-1.5">
            Sources
          </div>
          <div className="space-y-1">
            {sources.map((s, i) => (
              <a
                key={s.url ?? i}
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="group flex items-start gap-1.5 text-[11px] text-cyan-300/60
                           hover:text-cyan-200 transition-colors"
              >
                <span className="mt-0.5 shrink-0 text-cyan-400/30 group-hover:text-cyan-400/60">↗</span>
                <span className="truncate">{s.title ?? s.url ?? `Source ${i + 1}`}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </HudPanel>
  );
}

/* ── Parse "Section: Body" pattern from free-text ──────────────── */
function parseSections(text: string): { heading: string; body: string }[] {
  const SECTION_RE = /^(Situation|Supply.chain impact|Recommended actions?|Confidence)[:\s–-]+/im;
  const splits = text.split(/\n(?=(?:Situation|Supply[- ]chain impact|Recommended actions?|Confidence)[:\s–-])/i);
  if (splits.length < 2) return [{ heading: "", body: text.trim() }];
  return splits.map((chunk) => {
    const match = chunk.match(SECTION_RE);
    if (!match) return { heading: "", body: chunk.trim() };
    return {
      heading: match[1].replace(/[-_]/g, " "),
      body: chunk.slice(match[0].length).trim(),
    };
  });
}

/* ── Suggested query chips ──────────────────────────────────────── */
const SUGGESTIONS = [
  "Typhoon near Taiwan Strait risk zone?",
  "Red Sea shipping disruptions today?",
  "Oil price spike impact on logistics?",
  "Port of Shanghai congestion status?",
];

/* ── Main App ───────────────────────────────────────────────────── */
export default function App() {
  const { sendQuery } = useWebSocket();
  const [query, setQuery]         = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const connectionStatus  = useJarvisStore((s) => s.connectionStatus);
  const explanation       = useJarvisStore((s) => s.explanation);
  const sources           = useJarvisStore((s) => s.sources);
  const activeAgents      = useJarvisStore((s) => s.activeAgents);
  const lastQueryDuration = useJarvisStore((s) => s.lastQueryDurationMs);
  const fetchNetwork      = useJarvisStore((s) => s.fetchNetwork);

  useEffect(() => { fetchNetwork(); }, [fetchNetwork]);

  /* Mark as done when explanation arrives */
  useEffect(() => { if (explanation) setIsLoading(false); }, [explanation]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    sendQuery(trimmed);
    setIsLoading(true);
    setQuery("");
    inputRef.current?.blur();
  };

  const handleSuggestion = (s: string) => {
    sendQuery(s);
    setIsLoading(true);
  };

  return (
    <div className="relative h-full w-full overflow-hidden scanlines bg-[#03060f]">
      {/* ── Full-bleed map ────────────────────────────────────────── */}
      <WorldMap />

      {/* ── TOP BAR ──────────────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start gap-3 p-4">
        {/* Brand / logo */}
        <div className="pointer-events-auto glass rounded-2xl px-4 py-2.5 flex items-center gap-3
                        border border-cyan-400/15 shrink-0">
          <div className="flex flex-col">
            <span className="text-[11px] font-bold tracking-[0.22em] uppercase glow-text leading-none">
              Jarvis
            </span>
            <span className="text-[8px] tracking-[0.15em] text-cyan-400/40 uppercase">
              Supply Chain Intelligence
            </span>
          </div>
          <div className="w-px h-6 bg-cyan-400/15" />
          <ConnectionPill status={connectionStatus} />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Quick stats */}
        {activeAgents.length > 0 && (
          <div className="pointer-events-auto glass rounded-2xl px-3 py-2 flex items-center gap-2
                          border border-amber-400/15">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 pulse-dot" />
            <span className="text-[10px] text-amber-300 uppercase tracking-widest font-semibold">
              {activeAgents.length} agent{activeAgents.length !== 1 ? "s" : ""} active
            </span>
          </div>
        )}
      </div>

      {/* ── CENTRE QUERY BAR ─────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center pt-4 px-4">
        <div className="pointer-events-auto w-full max-w-2xl">
          <form onSubmit={handleSubmit}>
            <div
              className={`
                glass rounded-2xl border transition-all duration-300
                ${isFocused ? "border-cyan-400/50 shadow-[0_0_28px_rgba(34,211,238,0.18)]"
                            : "border-cyan-400/15"}
                flex items-center gap-2 px-4 py-2.5
              `}
            >
              {/* Search icon */}
              <svg className="w-4 h-4 text-cyan-400/40 shrink-0" fill="none" stroke="currentColor"
                   strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round"
                      d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>

              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder="Ask about a supply-chain risk, route, port, or event..."
                className="flex-1 bg-transparent text-sm text-cyan-50 placeholder-cyan-500/30
                           outline-none caret-cyan-400 min-w-0"
                id="jarvis-query-input"
              />

              {/* Loading spinner / Submit */}
              <button
                type="submit"
                disabled={!query.trim() || isLoading}
                className="shrink-0 flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px]
                           font-semibold uppercase tracking-widest transition-all duration-200
                           disabled:opacity-40 disabled:cursor-not-allowed
                           bg-cyan-500/15 border border-cyan-400/25 text-cyan-200
                           hover:bg-cyan-500/25 hover:border-cyan-400/50 hover:text-cyan-100"
              >
                {isLoading ? (
                  <>
                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10"
                              stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Analyzing
                  </>
                ) : (
                  <>Ask</>
                )}
              </button>
            </div>
          </form>

          {/* Suggestion chips — only show when input is empty & focused */}
          {isFocused && !query && (
            <div className="mt-2 flex flex-wrap gap-1.5 justify-center">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onMouseDown={(e) => { e.preventDefault(); handleSuggestion(s); }}
                  className="glass rounded-full px-3 py-1 text-[10px] text-cyan-300/65
                             border border-cyan-400/12 hover:border-cyan-400/35
                             hover:text-cyan-200 transition-all duration-200"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT: EXPLANATION PANEL ─────────────────────────────── */}
      {explanation && (
        <div className="pointer-events-auto absolute right-4 top-20 z-10 bottom-4
                        flex flex-col justify-start">
          <ExplanationPanel
            explanation={explanation}
            sources={sources}
            activeAgents={activeAgents}
            durationMs={lastQueryDuration}
          />
        </div>
      )}

      {/* ── BOTTOM-LEFT: AGENT CONSOLE ───────────────────────────── */}
      <AgentConsole />

      {/* ── LEGEND ───────────────────────────────────────────────── */}
      <div className="pointer-events-none absolute bottom-4 right-4 z-10 flex flex-col items-end gap-1.5">
        <div className="glass rounded-xl border border-white/6 px-3 py-2">
          <div className="text-[8px] font-semibold uppercase tracking-widest text-cyan-400/40 mb-1.5">
            Node types
          </div>
          <div className="space-y-1">
            {[
              { dot: "bg-yellow-400",  label: "Supplier" },
              { dot: "bg-blue-400",    label: "Factory" },
              { dot: "bg-violet-400",  label: "Warehouse" },
              { dot: "bg-emerald-400", label: "Port" },
            ].map(({ dot, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                <span className="text-[10px] text-cyan-300/50">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
