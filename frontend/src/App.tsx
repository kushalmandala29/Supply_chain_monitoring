import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

import AgentConsole from "./components/HUD/AgentConsole";
import ExplanationPanel from "./components/HUD/ExplanationPanel";
import { InfoPopup, PopupData } from "./components/HUD/InfoPopup";
import GlobalDashboard from "./components/HUD/kpi/GlobalDashboard";
import GlobeHUD from "./components/globe/GlobeHUD";
import { useWebSocket } from "./hooks/useWebSocket";
import { useJarvisStore } from "./store/useStore";

/* ── Connection pill ───────────────────────────────────────────── */
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

/* ── Suggested queries ─────────────────────────────────────────── */
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
  const fetchKpiNetwork   = useJarvisStore((s) => s.fetchKpiNetwork);
  const fetchKpiDashboard = useJarvisStore((s) => s.fetchKpiDashboard);
  const fetchKpiConfig    = useJarvisStore((s) => s.fetchKpiConfig);

  useEffect(() => { fetchNetwork(); }, [fetchNetwork]);
  useEffect(() => { fetchKpiNetwork(); }, [fetchKpiNetwork]);
  useEffect(() => { fetchKpiDashboard(); }, [fetchKpiDashboard]);
  useEffect(() => { fetchKpiConfig(); }, [fetchKpiConfig]);
  useEffect(() => { if (explanation) setIsLoading(false); }, [explanation]);

  /* ── Popup management ─────────────────────────────────────────── */
  const [popups, setPopups]   = useState<PopupData[]>([]);
  const [topId,  setTopId]    = useState<string | null>(null);

  const openPopup = useCallback((popup: PopupData) => {
    setPopups((prev) => {
      // Limit to 6 simultaneous windows
      const trimmed = prev.length >= 6 ? prev.slice(1) : prev;
      return [...trimmed, popup];
    });
    setTopId(popup.id);
  }, []);

  const closePopup = useCallback((id: string) => {
    setPopups((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const focusPopup = useCallback((id: string) => setTopId(id), []);

  /* Clear popups whenever a new query fires */
  useEffect(() => { if (isLoading) setPopups([]); }, [isLoading]);

  /* ── Handlers ─────────────────────────────────────────────────── */
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

      {/* ── Full-bleed 3D globe ──────────────────────────────────── */}
      <GlobeHUD />

      {/* ── TOP BAR ─────────────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start gap-3 p-4">
        {/* Brand */}
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

        <div className="flex-1" />

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

      {/* ── CENTRE QUERY BAR ────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center pt-4 px-4">
        <div className="pointer-events-auto w-full max-w-2xl">
          <form onSubmit={handleSubmit}>
            <div
              className={`
                glass rounded-2xl border transition-all duration-300
                ${isFocused
                  ? "border-cyan-400/50 shadow-[0_0_28px_rgba(34,211,238,0.18)]"
                  : "border-cyan-400/15"}
                flex items-center gap-2 px-4 py-2.5
              `}
            >
              <svg className="w-4 h-4 text-cyan-400/40 shrink-0" fill="none"
                   stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
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
                ) : "Ask"}
              </button>
            </div>
          </form>

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

      {/* ── LEFT: GLOBAL KPI DASHBOARD ───────────────────────────── */}
      <div className="pointer-events-auto absolute left-4 top-20 z-10 w-72">
        <GlobalDashboard />
      </div>

      {/* ── RIGHT: STREAMING EXPLANATION PANEL ──────────────────── */}
      {explanation && (
        <div className="pointer-events-auto absolute right-4 top-20 z-10 bottom-4
                        flex flex-col justify-start">
          <ExplanationPanel
            explanation={explanation}
            sources={sources}
            activeAgents={activeAgents}
            durationMs={lastQueryDuration}
            onOpenPopup={openPopup}
          />
        </div>
      )}

      {/* ── FLOATING INFO POPUPS (portal layer) ─────────────────── */}
      {popups.map((popup, i) => (
        <InfoPopup
          key={popup.id}
          popup={popup}
          onClose={closePopup}
          onFocus={focusPopup}
          zIndex={200 + (popup.id === topId ? popups.length : i)}
        />
      ))}

      {/* ── BOTTOM-LEFT: AGENT CONSOLE ──────────────────────────── */}
      <AgentConsole />

      {/* ── BOTTOM-RIGHT: LEGEND ────────────────────────────────── */}
      <div className="pointer-events-none absolute bottom-4 right-4 z-10">
        <div className="glass rounded-xl border border-white/6 px-3 py-2">
          <div className="text-[8px] font-semibold uppercase tracking-widest text-cyan-400/40 mb-1.5">
            Node types
          </div>
          <div className="space-y-1">
            {[
              { dot: "bg-yellow-400",  label: "Supplier"   },
              { dot: "bg-blue-400",    label: "Factory"    },
              { dot: "bg-violet-400",  label: "Warehouse"  },
              { dot: "bg-emerald-400", label: "Port"       },
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
