import { FormEvent, useEffect, useRef, useState } from "react";

import { useJarvisStore } from "../../store/useStore";
import { useWorkspaceStore } from "../../store/useWorkspaceStore";

function ConnectionPill({ status }: { status: "connecting" | "open" | "closed" }) {
  const cfg = {
    connecting: { dot: "bg-amber-400", label: "CONNECTING", text: "text-amber-300" },
    open: { dot: "bg-emerald-400", label: "LIVE", text: "text-emerald-300" },
    closed: { dot: "bg-red-400", label: "OFFLINE", text: "text-red-300" },
  }[status];

  return (
    <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1 border border-white/8 bg-white/[0.02]">
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${status === "open" ? "pulse-dot" : ""}`} />
      <span className={`text-[10px] font-semibold tracking-widest uppercase ${cfg.text}`}>{cfg.label}</span>
    </div>
  );
}

const SUGGESTIONS = [
  "Typhoon near Taiwan Strait risk zone?",
  "Red Sea shipping disruptions today?",
  "Oil price spike impact on logistics?",
  "Port of Shanghai congestion status?",
];

export default function Topbar() {
  const connectionStatus = useJarvisStore((s) => s.connectionStatus);
  const activeAgents = useJarvisStore((s) => s.activeAgents);
  const sendQuery = useJarvisStore((s) => s.sendQuery);
  const addSearchHistory = useWorkspaceStore((s) => s.addSearchHistory);
  const searchHistory = useWorkspaceStore((s) => s.searchHistory);

  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const explanation = useJarvisStore((s) => s.explanation);

  useEffect(() => {
    if (explanation) setIsLoading(false);
  }, [explanation]);

  const fire = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    sendQuery(trimmed);
    addSearchHistory(trimmed);
    setIsLoading(true);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    fire(query);
    setQuery("");
    inputRef.current?.blur();
  };

  return (
    <header className="shrink-0 flex items-center gap-3 px-4 py-2.5 border-b border-cyan-400/10 glass z-10">
      <ConnectionPill status={connectionStatus} />

      {activeAgents.length > 0 && (
        <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1 border border-amber-400/15 bg-amber-400/5 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 pulse-dot" />
          <span className="text-[10px] text-amber-300 uppercase tracking-widest font-semibold">
            {activeAgents.length} agent{activeAgents.length !== 1 ? "s" : ""} active
          </span>
        </div>
      )}

      <div className="flex-1 flex justify-center">
        <div className="w-full max-w-2xl relative">
          <form onSubmit={handleSubmit}>
            <div
              className={`
                rounded-2xl border transition-all duration-300 bg-black/20
                ${isFocused ? "border-cyan-400/50 shadow-[0_0_28px_rgba(34,211,238,0.18)]" : "border-cyan-400/15"}
                flex items-center gap-2 px-4 py-2
              `}
            >
              <svg className="w-4 h-4 text-cyan-400/40 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setTimeout(() => setIsFocused(false), 120)}
                placeholder="Ask about a supply-chain risk, route, port, or event..."
                className="flex-1 bg-transparent text-sm text-cyan-50 placeholder-cyan-500/30 outline-none caret-cyan-400 min-w-0"
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
                {isLoading ? "Analyzing" : "Ask"}
              </button>
            </div>
          </form>

          {isFocused && (
            <div className="absolute top-full mt-2 left-0 right-0 glass rounded-xl border border-cyan-400/15 p-2 z-30 space-y-2">
              {query && searchHistory.length > 0 && (
                <div className="space-y-0.5">
                  {searchHistory
                    .filter((h) => h.query.toLowerCase().includes(query.toLowerCase()))
                    .slice(0, 5)
                    .map((h) => (
                      <button
                        key={h.id}
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); fire(h.query); setQuery(""); }}
                        className="block w-full text-left px-2 py-1 rounded-lg text-[11px] text-cyan-300/70 hover:bg-white/5 hover:text-cyan-100"
                      >
                        {h.query}
                      </button>
                    ))}
                </div>
              )}
              {!query && (
                <div className="flex flex-wrap gap-1.5 justify-center px-1 py-1">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); fire(s); }}
                      className="rounded-full px-3 py-1 text-[10px] text-cyan-300/65 border border-cyan-400/12
                                 hover:border-cyan-400/35 hover:text-cyan-200 transition-all duration-200"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="w-[7.5rem] shrink-0" />
    </header>
  );
}
