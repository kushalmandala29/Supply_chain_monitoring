import { useEffect, useRef, useState } from "react";
import { Source } from "../../store/useStore";
import { SourceCard } from "./SourceCard";

/* ── Types ─────────────────────────────────────────────────────── */

export interface PopupData {
  id:       string;
  /** Header label distinguishing this popup's proof type when several are
   * open at once (e.g. "Satellite view" vs "Web sources" vs "Live news") */
  label?: string;
  /** Quoted text, when this popup was spawned from a sentence click */
  sentence?: string;
  /** Direct image URL, when this popup was auto-spawned by an imagery event (e.g. Vision Agent) */
  imageUrl?: string;
  imageCaption?: string;
  /** Sources relevant to this sentence (pre-filtered by caller) */
  sources:  Source[];
  /** Initial screen position (px) */
  x: number;
  y: number;
}

interface InfoPopupProps {
  popup:   PopupData;
  onClose: (id: string) => void;
  zIndex:  number;
  onFocus: (id: string) => void;
}

/* ── Component ──────────────────────────────────────────────────── */

export function InfoPopup({ popup, onClose, zIndex, onFocus }: InfoPopupProps) {
  const [pos, setPos]       = useState({ x: popup.x, y: popup.y });
  const [visible, setVisible] = useState(false);
  const dragging  = useRef(false);
  const origin    = useRef({ mx: 0, my: 0, px: 0, py: 0 });

  /* Entrance: micro-delay so CSS transition fires after mount */
  useEffect(() => {
    const id = setTimeout(() => setVisible(true), 16);
    return () => clearTimeout(id);
  }, []);

  /* Keep window inside viewport */
  useEffect(() => {
    const W = window.innerWidth;
    const H = window.innerHeight;
    setPos((p) => ({
      x: Math.min(Math.max(p.x, 8), W - 328),
      y: Math.min(Math.max(p.y, 8), H - 100),
    }));
  }, []);

  /* ── Drag ──────────────────────────────────────────────────────── */
  const startDrag = (e: React.MouseEvent) => {
    onFocus(popup.id);
    dragging.current = true;
    origin.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };
    e.preventDefault();
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      setPos({
        x: origin.current.px + e.clientX - origin.current.mx,
        y: origin.current.py + e.clientY - origin.current.my,
      });
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
    };
  }, []);

  return (
    <div
      className={`
        fixed w-80 glass rounded-2xl overflow-hidden select-none
        border border-cyan-400/30
        transition-all duration-300 ease-out
        shadow-[0_0_32px_rgba(34,211,238,0.15),0_8px_40px_rgba(0,0,0,0.6)]
        ${visible ? "opacity-100 scale-100" : "opacity-0 scale-90"}
      `}
      style={{ left: pos.x, top: pos.y, zIndex }}
      onMouseDown={() => onFocus(popup.id)}
    >
      {/* ── Header / drag handle ──────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b border-white/6
                   cursor-grab active:cursor-grabbing"
        style={{ background: "rgba(34,211,238,0.04)" }}
        onMouseDown={startDrag}
      >
        <div className="flex items-center gap-2">
          {/* traffic-light close */}
          <button
            className="w-3 h-3 rounded-full bg-red-400/50 hover:bg-red-400 transition-colors"
            onClick={() => onClose(popup.id)}
            onMouseDown={(e) => e.stopPropagation()}
            title="Close"
          />
          <span className="text-[9px] font-mono text-cyan-400/40">◈ {(popup.label ?? "INTEL DETAIL").toUpperCase()}</span>
        </div>
        <span className="text-[8px] font-mono text-cyan-400/25 uppercase tracking-widest">
          drag to move
        </span>
      </div>

      {/* ── Image (auto-popups from imagery events) ─────────────────── */}
      {popup.imageUrl && (
        <div className="px-3 pt-3 pb-1">
          <img
            src={popup.imageUrl}
            alt={popup.imageCaption ?? "Satellite imagery"}
            className="w-full rounded-lg border border-cyan-400/15 object-cover"
            style={{ maxHeight: "14rem" }}
            loading="lazy"
          />
          {popup.imageCaption && (
            <p className="mt-1.5 text-[10px] text-cyan-300/50 truncate">{popup.imageCaption}</p>
          )}
        </div>
      )}

      {/* ── Quoted sentence ──────────────────────────────────────────── */}
      {popup.sentence && (
        <div className="px-3 pt-3 pb-2">
          <div
            className="rounded-xl border border-cyan-400/15 px-3 py-2.5"
            style={{ background: "rgba(34,211,238,0.05)" }}
          >
            {/* decorative left bar */}
            <div className="flex gap-2">
              <div className="w-0.5 rounded-full bg-cyan-400/40 shrink-0" />
              <p className="text-[12px] text-cyan-100/90 leading-relaxed font-light italic">
                {popup.sentence}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Related sources -- every source the agent actually found, not a
           fixed count (some queries turn up 2, some turn up 15) ────────── */}
      {popup.sources.length > 0 ? (
        <div className="px-3 pb-3 space-y-2">
          <div className="text-[8px] font-semibold uppercase tracking-widest text-cyan-400/35 mb-1">
            Related intelligence · {popup.sources.length}
          </div>
          <div className="space-y-2 max-h-[22rem] overflow-y-auto pr-0.5">
            {popup.sources.map((s, i) => (
              <SourceCard key={s.url ?? i} source={s} index={i} delay={Math.min(i, 8) * 60} />
            ))}
          </div>
        </div>
      ) : popup.sentence ? (
        <div className="px-3 pb-3">
          <p className="text-[10px] text-cyan-400/30 italic">No direct sources for this point.</p>
        </div>
      ) : null}
    </div>
  );
}
