import { MapLayerToggles, useWorkspaceStore } from "../../store/useWorkspaceStore";

const TOGGLES: { key: keyof MapLayerToggles; label: string }[] = [
  { key: "routes", label: "Routes" },
  { key: "geofences", label: "Risk zones" },
  { key: "alerts", label: "Alerts" },
  { key: "commodityHeatmap", label: "Commodity heatmap" },
];

/** Compact in-map layer control so clutter is opt-in, not permanent --
 * mirrors the same toggles Settings exposes, kept in sync via the same
 * useWorkspaceStore.mapLayers state MapCanvas gates its layers on. */
export default function LayerToggles() {
  const mapLayers = useWorkspaceStore((s) => s.mapLayers);
  const toggleMapLayer = useWorkspaceStore((s) => s.toggleMapLayer);

  return (
    <div className="pointer-events-auto glass rounded-xl border border-white/6 px-3 py-2 space-y-1.5">
      <div className="text-[8px] font-semibold uppercase tracking-widest text-cyan-400/40 mb-1">
        Layers
      </div>
      {TOGGLES.map(({ key, label }) => (
        <label key={key} className="flex items-center gap-2 text-[10px] text-cyan-100/70 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={mapLayers[key]}
            onChange={() => toggleMapLayer(key)}
            className="accent-cyan-400 w-3 h-3"
          />
          {label}
        </label>
      ))}
    </div>
  );
}
