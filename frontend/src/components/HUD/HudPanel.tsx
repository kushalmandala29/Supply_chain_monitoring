import { CSSProperties, ReactNode } from "react";

interface HudPanelProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  accentColor?: "cyan" | "amber" | "red" | "green";
  noPad?: boolean;
}

const ACCENT = {
  cyan:  { border: "border-cyan-400/25",  title: "text-cyan-400",   glow: "shadow-[0_0_20px_rgba(34,211,238,0.12)]" },
  amber: { border: "border-amber-400/25", title: "text-amber-400",  glow: "shadow-[0_0_20px_rgba(251,191,36,0.12)]" },
  red:   { border: "border-red-400/25",   title: "text-red-400",    glow: "shadow-[0_0_20px_rgba(248,113,113,0.12)]" },
  green: { border: "border-emerald-400/25", title: "text-emerald-400", glow: "shadow-[0_0_20px_rgba(52,211,153,0.12)]" },
};

export default function HudPanel({
  title,
  subtitle,
  children,
  className = "",
  style,
  accentColor = "cyan",
  noPad = false,
}: HudPanelProps) {
  const acc = ACCENT[accentColor];
  return (
    <div
      className={`
        glass rounded-2xl border ${acc.border} ${acc.glow}
        transition-all duration-300
        ${className}
      `}
      style={style}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-2.5">
        <div className="flex items-center gap-2">
          {/* Corner bracket decoration */}
          <span className={`text-[10px] font-mono ${acc.title} opacity-60`}>◈</span>
          <span className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${acc.title}`}>
            {title}
          </span>
        </div>
        {subtitle && (
          <span className="text-[9px] font-mono text-cyan-400/40 tracking-widest uppercase">
            {subtitle}
          </span>
        )}
      </div>

      {/* Body */}
      <div className={noPad ? "" : "p-4"}>
        {children}
      </div>
    </div>
  );
}
