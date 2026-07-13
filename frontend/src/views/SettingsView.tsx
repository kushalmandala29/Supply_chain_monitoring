import HudPanel from "../components/HUD/HudPanel";
import { useWorkspaceStore } from "../store/useWorkspaceStore";

export default function SettingsView() {
  const mapLayers = useWorkspaceStore((s) => s.mapLayers);
  const toggleMapLayer = useWorkspaceStore((s) => s.toggleMapLayer);

  return (
    <div className="h-full w-full overflow-y-auto p-6">
      <HudPanel title="Settings" subtitle="Map layers" accentColor="cyan" className="max-w-md">
        <div className="space-y-2">
          {Object.entries(mapLayers).map(([key, enabled]) => (
            <label key={key} className="flex items-center justify-between text-[11px] text-cyan-100/80 capitalize">
              {key.replace(/([A-Z])/g, " $1")}
              <input
                type="checkbox"
                checked={enabled}
                onChange={() => toggleMapLayer(key as keyof typeof mapLayers)}
                className="accent-cyan-400"
              />
            </label>
          ))}
        </div>
        <p className="text-[9px] text-cyan-400/30 italic mt-4">
          These toggles wire into the Live Map's layer stack starting Phase 2.
        </p>
      </HudPanel>
    </div>
  );
}
