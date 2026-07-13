import { useState } from "react";

import HudPanel from "../components/HUD/HudPanel";
import { useWorkspaceStore } from "../store/useWorkspaceStore";

export default function InvestigationsView() {
  const investigations = useWorkspaceStore((s) => s.investigations);
  const createInvestigation = useWorkspaceStore((s) => s.createInvestigation);
  const [name, setName] = useState("");

  return (
    <div className="h-full w-full overflow-y-auto p-6">
      <HudPanel title="Investigations" subtitle={`${investigations.length} saved`} accentColor="cyan" className="max-w-xl" noPad>
        <div className="p-4 flex gap-2 border-b border-white/5">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New investigation name..."
            className="flex-1 bg-black/20 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-cyan-50 outline-none focus:border-cyan-400/40"
          />
          <button
            type="button"
            disabled={!name.trim()}
            onClick={() => { createInvestigation(name.trim()); setName(""); }}
            className="shrink-0 rounded-lg px-3 py-1.5 text-[10px] uppercase tracking-widest
                       bg-cyan-500/15 border border-cyan-400/25 text-cyan-200
                       hover:bg-cyan-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Create
          </button>
        </div>
        <div className="divide-y divide-white/5">
          {investigations.length === 0 && (
            <div className="px-4 py-6 text-center text-[11px] text-cyan-300/40">
              No investigations yet. Pin entities and save them here as you dig into a supply-chain event.
            </div>
          )}
          {investigations.map((inv) => (
            <div key={inv.id} className="px-4 py-2.5">
              <div className="text-[12px] text-cyan-100">{inv.name}</div>
              <div className="text-[9px] text-cyan-400/40 mt-0.5">
                {inv.pinnedEntityIds.length} pinned entit{inv.pinnedEntityIds.length === 1 ? "y" : "ies"} &middot; updated{" "}
                {new Date(inv.updatedAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
        <div className="px-4 py-3 text-[9px] text-cyan-400/30 italic border-t border-white/5">
          Full workspace (pinning, comparisons, article collection, event replay) lands in Phase 6.
        </div>
      </HudPanel>
    </div>
  );
}
