import { useJarvisStore } from "../store/useStore";
import HudPanel from "../components/HUD/HudPanel";

const STREAM_CONFIG = {
  news_ingested: { label: "News", color: "text-blue-300", border: "border-blue-400/20", bg: "bg-blue-400/10", icon: "📰" },
  weather_updated: { label: "Weather", color: "text-cyan-300", border: "border-cyan-400/20", bg: "bg-cyan-400/10", icon: "⛈️" },
  satellite_ready: { label: "Satellite", color: "text-purple-300", border: "border-purple-400/20", bg: "bg-purple-400/10", icon: "🛰️" },
  commodity_updated: { label: "Commodity", color: "text-amber-300", border: "border-amber-400/20", bg: "bg-amber-400/10", icon: "📈" },
  risk_detected: { label: "Risk Alert", color: "text-red-300", border: "border-red-400/20", bg: "bg-red-400/10", icon: "⚠️" },
};

const RISK_COLOR: Record<string, string> = {
  high: "text-red-300", medium: "text-amber-300", low: "text-emerald-300",
};

function WeatherContent({ payload }: { payload: any }) {
  const entities = (payload.entities ?? []) as Array<{ entity_id: string; risk: number; wind_speed_kmh: number; precipitation_mm: number }>;
  const notable = [...entities].sort((a, b) => b.risk - a.risk).slice(0, 5);
  if (notable.length === 0) return <p className="text-cyan-300/40">No facility weather data yet.</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {notable.map((e) => (
        <span
          key={e.entity_id}
          className={`text-[10px] rounded-full px-2 py-0.5 border border-white/10 ${e.risk >= 0.6 ? "text-red-300 bg-red-400/10" : e.risk >= 0.3 ? "text-amber-300 bg-amber-400/10" : "text-cyan-300/70 bg-white/5"}`}
        >
          {e.entity_id} · wind {e.wind_speed_kmh.toFixed(0)}km/h
        </span>
      ))}
    </div>
  );
}

function SatelliteContent({ payload }: { payload: any }) {
  const first = (payload.imagery ?? [])[0];
  if (!first) return <p className="text-cyan-300/40">No imagery resolved.</p>;
  return (
    <div className="space-y-1.5">
      {first.snapshot_url && (
        <img
          src={first.snapshot_url}
          alt={payload.center?.label ?? first.description}
          className="w-full max-w-md rounded-lg border border-white/10 object-cover"
          style={{ maxHeight: "12rem" }}
          loading="lazy"
        />
      )}
      <div className="text-[11px] text-cyan-300/60">
        {payload.center?.label && <span>{payload.center.label} · </span>}
        {first.date} · {first.description}
      </div>
    </div>
  );
}

function RiskContent({ payload }: { payload: any }) {
  const entities = (payload.operational_risk ?? []) as Array<{ entity_id: string; severity: string; compounded_risk: number }>;
  if (entities.length === 0) return <p className="text-cyan-300/40">{payload.note ?? "No risk data yet."}</p>;
  return (
    <div className="space-y-1">
      {[...entities].sort((a, b) => b.compounded_risk - a.compounded_risk).slice(0, 5).map((e) => (
        <div key={e.entity_id} className="flex items-center justify-between text-[11px]">
          <span className="text-cyan-100/80">{e.entity_id}</span>
          <span className={`font-mono ${RISK_COLOR[e.severity] ?? "text-cyan-300/60"}`}>
            {e.severity} · {(e.compounded_risk * 100).toFixed(0)}%
          </span>
        </div>
      ))}
    </div>
  );
}

function NewsContent({ payload }: { payload: any }) {
  return (
    <div className="space-y-3">
      {(payload.articles as any[]).map((article: any, i: number) => (
        <div key={i} className="flex gap-2">
          {article.image_url && (
            <img src={article.image_url} alt="" className="w-12 h-12 rounded object-cover border border-white/10 shrink-0" />
          )}
          <div>
            <div className="font-semibold text-sm leading-tight">{article.title}</div>
            {article.url && (
              <a href={article.url} target="_blank" rel="noreferrer" className="text-[11px] text-blue-400 hover:underline">
                Source link
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function IntelligenceFeedView() {
  const trace = useJarvisStore((s) => s.trace);

  const feedItems = trace
    .filter((t) => t.stream in STREAM_CONFIG)
    .filter((t) => {
      const p = t.payload as any;
      if (t.stream === "satellite_ready" && (!p.imagery || p.imagery.length === 0)) return false;
      if (t.stream === "commodity_updated" && (!p.commodities || p.commodities.length === 0) && (!p.prices || p.prices.length === 0) && (!p.inventory_trends || p.inventory_trends.length === 0)) return false;
      if (t.stream === "news_ingested" && (!p.articles || p.articles.length === 0)) return false;
      if (t.stream === "weather_updated" && (!p.entities || p.entities.length === 0)) return false;
      if (t.stream === "risk_detected" && (!p.operational_risk || p.operational_risk.length === 0) && !p.note) return false;
      return true;
    })
    .reverse(); // Newest first

  return (
    <div className="h-full w-full overflow-y-auto p-6">
      <HudPanel title="Intelligence Feed" subtitle={`${feedItems.length} recent updates`} accentColor="cyan" className="max-w-4xl" noPad>
        <div className="divide-y divide-white/5 max-h-[75vh] overflow-y-auto">
          {feedItems.length === 0 && (
            <div className="px-6 py-10 text-center text-[12px] text-cyan-300/40">
              No intelligence updates yet. Waiting for agent feeds...
            </div>
          )}
          {feedItems.map((item) => {
            const config = STREAM_CONFIG[item.stream as keyof typeof STREAM_CONFIG];
            const payload = item.payload as any;

            return (
              <div key={item.id} className="p-4 hover:bg-white/[0.02] transition-colors">
                <div className="flex gap-4">
                  <div className={`shrink-0 w-10 h-10 rounded-xl border flex items-center justify-center text-lg
                    ${config.border} ${config.bg}`}>
                    {config.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-4 mb-1">
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${config.color}`}>
                        {config.label}
                      </span>
                      <span className="text-[10px] text-cyan-500/40">
                        {new Date(item.receivedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </span>
                    </div>
                    <div className="text-[13px] text-cyan-50 leading-relaxed break-words">
                      {item.stream === "news_ingested" ? (
                        <NewsContent payload={payload} />
                      ) : item.stream === "weather_updated" ? (
                        <WeatherContent payload={payload} />
                      ) : item.stream === "satellite_ready" ? (
                        <SatelliteContent payload={payload} />
                      ) : item.stream === "risk_detected" ? (
                        <RiskContent payload={payload} />
                      ) : (
                        <pre className="text-[11px] text-cyan-200/60 mt-1 whitespace-pre-wrap font-mono">
                          {JSON.stringify(payload, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </HudPanel>
    </div>
  );
}
