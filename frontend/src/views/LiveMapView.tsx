import LayerToggles from "../components/map/LayerToggles";
import MapCanvas from "../components/map/MapCanvas";

const LEGEND: { dot: string; label: string }[] = [
  { dot: "bg-yellow-400", label: "Supplier" },
  { dot: "bg-blue-400", label: "Factory" },
  { dot: "bg-violet-400", label: "Warehouse" },
  { dot: "bg-emerald-400", label: "Port" },
];

export default function LiveMapView() {
  return (
    <div className="absolute inset-0">
      <MapCanvas />

      <div className="pointer-events-none absolute top-4 right-4 z-10">
        <LayerToggles />
      </div>

      <div className="pointer-events-none absolute bottom-8 right-4 z-10">
        <div className="pointer-events-auto glass rounded-xl border border-white/6 px-3 py-2">
          <div className="text-[8px] font-semibold uppercase tracking-widest text-cyan-400/40 mb-1.5">
            Node types
          </div>
          <div className="space-y-1">
            {LEGEND.map(({ dot, label }) => (
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
