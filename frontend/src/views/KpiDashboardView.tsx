import { useState } from "react";

import GlobalDashboard from "../components/HUD/kpi/GlobalDashboard";
import KpiPanel from "../components/HUD/kpi/KpiPanel";
import HudPanel from "../components/HUD/HudPanel";
import { useJarvisStore } from "../store/useStore";

export default function KpiDashboardView() {
  const kpiByEntity = useJarvisStore((s) => s.kpiByEntity);
  const networkNodes = useJarvisStore((s) => s.networkNodes);
  const kpiConfig = useJarvisStore((s) => s.kpiConfig);

  const entities = Object.values(kpiByEntity);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const nameFor = (id: string) => networkNodes.find((n) => n.id === id)?.name ?? id;
  const active = selectedId ?? entities[0]?.entityId ?? null;
  const activeEntity = active ? kpiByEntity[active] : undefined;

  return (
    <div className="h-full w-full overflow-y-auto p-6 space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 max-w-6xl">
        <div className="lg:col-span-1 space-y-4">
          <GlobalDashboard />
          <HudPanel title="Entities" subtitle={`${entities.length} tracked`} accentColor="cyan" noPad>
            <div className="max-h-72 overflow-y-auto divide-y divide-white/5">
              {entities.length === 0 && (
                <div className="px-4 py-3 text-[11px] text-cyan-300/40">No KPI data yet.</div>
              )}
              {entities.map((e) => (
                <button
                  key={e.entityId}
                  type="button"
                  onClick={() => setSelectedId(e.entityId)}
                  className={`w-full text-left px-4 py-2 text-[11px] truncate transition-colors
                    ${active === e.entityId ? "bg-cyan-400/10 text-cyan-200" : "text-cyan-300/60 hover:bg-white/5"}`}
                >
                  {nameFor(e.entityId)}
                  <span className="text-[9px] text-cyan-400/30 ml-1">({e.entityType})</span>
                </button>
              ))}
            </div>
          </HudPanel>
        </div>

        <div className="lg:col-span-2">
          {activeEntity ? (
            <KpiPanel
              entityId={activeEntity.entityId}
              entityName={nameFor(activeEntity.entityId)}
              kpis={activeEntity.kpis}
              kpiConfig={kpiConfig}
            />
          ) : (
            <HudPanel title="KPI Breakdown" accentColor="cyan">
              <p className="text-[11px] text-cyan-300/40">Select an entity to see its full KPI breakdown.</p>
            </HudPanel>
          )}
        </div>
      </div>
    </div>
  );
}
