import { useMemo } from "react";
import { Source } from "../../store/useStore";

/* ── Utility helpers ───────────────────────────────────────────── */

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function getYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) return u.searchParams.get("v");
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1).split("?")[0];
  } catch { /* ignore */ }
  return null;
}

/** Google's public favicon service — no auth needed, very fast. */
function faviconUrl(url: string): string {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  } catch {
    return "";
  }
}

/** Domain-based pastel gradient so every card has a unique colour. */
function domainColor(domain: string): string {
  let hash = 0;
  for (const ch of domain) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffff;
  const hue = hash % 360;
  return `hsl(${hue},40%,18%)`;
}

/* ── Thumbnail component ───────────────────────────────────────── */

function Thumbnail({ url, imageUrl }: { url: string; imageUrl?: string }) {
  if (imageUrl) {
    return (
      <div className="relative w-full h-full">
        <img
          src={imageUrl}
          alt=""
          className="w-full h-full object-cover opacity-90"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
      </div>
    );
  }

  const ytId = getYouTubeId(url);

  if (ytId) {
    return (
      <div className="relative w-full h-full">
        <img
          src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
          alt=""
          className="w-full h-full object-cover"
        />
        {/* play button overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <div className="w-7 h-7 rounded-full bg-red-600/90 flex items-center justify-center shadow-lg">
            <div className="w-0 h-0 border-y-[5px] border-y-transparent border-l-[9px] border-l-white ml-0.5" />
          </div>
        </div>
      </div>
    );
  }

  /* For normal URLs, show the favicon centred on a domain-tinted bg */
  const favicon = faviconUrl(url);
  const domain  = extractDomain(url);
  const bg      = domainColor(domain);
  const initial = domain.charAt(0).toUpperCase();

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center gap-1"
      style={{ background: bg }}
    >
      {favicon ? (
        <img
          src={favicon}
          alt=""
          className="w-7 h-7 opacity-80"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
      ) : (
        <span className="text-xl font-bold text-white/30">{initial}</span>
      )}
    </div>
  );
}

/* ── SourceCard ────────────────────────────────────────────────── */

interface SourceCardProps {
  source: Source;
  index:  number;
  /** ms stagger before the slide-up animation fires */
  delay?: number;
}

export function SourceCard({ source, index: _index, delay = 0 }: SourceCardProps) {
  const url    = source.url ?? "";
  const domain = useMemo(() => extractDomain(url), [url]);
  const isYT   = useMemo(() => !!getYouTubeId(url), [url]);
  const title  = source.title ?? domain;

  return (
    <a
      href={url || undefined}
      target="_blank"
      rel="noreferrer"
      className="group flex gap-3 p-2.5 rounded-xl border border-white/6
                 bg-white/2 hover:bg-cyan-400/5 hover:border-cyan-400/25
                 transition-all duration-300 slide-up cursor-pointer"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Thumbnail box */}
      <div className="w-[72px] h-[48px] rounded-lg overflow-hidden shrink-0 border border-white/6">
        <Thumbnail url={url} imageUrl={source.image_url} />
      </div>

      {/* Text block */}
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          {isYT && (
            <span className="text-[9px] font-semibold uppercase tracking-widest text-red-400/80 mb-0.5 block">
              ▶ Video
            </span>
          )}
          <p className="text-[11px] font-medium text-cyan-100/80 leading-snug line-clamp-2
                        group-hover:text-cyan-100 transition-colors">
            {title}
          </p>
          {/* Short description so a video/text source isn't just a bare link */}
          {source.content && (
            <p className="text-[10px] text-cyan-300/40 leading-snug line-clamp-2 mt-0.5">
              {source.content}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 mt-1">
          <span className="text-[9px] text-cyan-400/35 truncate">{domain}</span>
          <span className="text-cyan-400/20 text-[9px] ml-auto group-hover:text-cyan-400/50 transition-colors">
            ↗
          </span>
        </div>
      </div>
    </a>
  );
}
