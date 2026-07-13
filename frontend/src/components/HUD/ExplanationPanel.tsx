import { useCallback, useState } from "react";
import { Source } from "../../store/useStore";
import { useTypewriter } from "../../hooks/useTypewriter";
import { SourceCard } from "./SourceCard";
import { PopupData } from "./InfoPopup";
import HudPanel from "./HudPanel";

/* ──────────────────────────────────────────────────────────────────
   SECTION PARSER
   Splits "Situation:\n...\nSupply-chain impact:\n..." into labelled
   sections, then further into individual sentences for click targets.
────────────────────────────────────────────────────────────────── */

interface Section {
  heading: string;
  sentences: string[];
}

const SECTION_SPLIT_RE =
  /\n(?=(?:Situation|Supply[- ]chain impact|Recommended actions?|Confidence)[:\s–-])/gi;
const SECTION_HEADING_RE =
  /^(#{1,3}\s*)?(Situation|Supply[- ]chain impact|Recommended actions?|Confidence)[:\s–-]+/i;

function parseSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8);
}

function parseSections(text: string): Section[] {
  const raw = text.split(SECTION_SPLIT_RE);
  if (raw.length < 2)
    return [{ heading: "", sentences: parseSentences(text.trim()) }];

  return raw.map((chunk) => {
    const m = chunk.match(SECTION_HEADING_RE);
    if (!m) return { heading: "", sentences: parseSentences(chunk.trim()) };
    const heading = m[2].replace(/[-_]/g, " ");
    const body    = chunk.slice(m[0].length).trim();
    return { heading, sentences: parseSentences(body) };
  });
}

/* ──────────────────────────────────────────────────────────────────
   SOURCE RELEVANCE
   Match sources to a sentence via keyword overlap (no backend change
   needed — uses the snippet `content` already in the store).
────────────────────────────────────────────────────────────────── */

function keywords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 4),
  );
}

function relevantSources(sentence: string, sources: Source[]): Source[] {
  const sk = keywords(sentence);
  const scored = sources.map((s) => {
    const pool = `${s.title ?? ""} ${s.content ?? ""}`;
    const pk   = keywords(pool);
    const overlap = [...sk].filter((w) => pk.has(w)).length;
    return { s, overlap };
  });
  const filtered = scored.filter(({ overlap }) => overlap > 0);
  if (filtered.length === 0) return sources.slice(0, 2); // fallback: first 2
  return filtered
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, 3)
    .map(({ s }) => s);
}

/* ──────────────────────────────────────────────────────────────────
   SENTENCE ROW — clickable, highlights on hover, opens popup
────────────────────────────────────────────────────────────────── */

let _popupCounter = 0;

interface SentenceRowProps {
  text:      string;
  revealed:  boolean;   // true once typewriter has reached this sentence
  onOpen:    (popup: PopupData) => void;
  sources:   Source[];
}

function SentenceRow({ text, revealed, onOpen, sources }: SentenceRowProps) {
  const [hovered, setHovered] = useState(false);

  const openPopup = useCallback(
    (e: React.MouseEvent) => {
      if (!revealed) return;
      const id    = `popup-${++_popupCounter}`;
      const rect  = (e.currentTarget as HTMLElement).getBoundingClientRect();
      // Offset the popup so it doesn't cover the text
      const x = Math.min(rect.left - 296, window.innerWidth - 300);
      const y = rect.top - 20;
      onOpen({ id, sentence: text, sources: relevantSources(text, sources), x, y });
    },
    [revealed, text, sources, onOpen],
  );

  return (
    <span
      className={`
        inline cursor-pointer rounded px-0.5 -mx-0.5 leading-[1.75]
        transition-all duration-200
        ${revealed
          ? "text-cyan-100/90 hover:text-white hover:bg-cyan-400/10"
          : "text-cyan-100/20"
        }
        ${hovered ? "underline decoration-cyan-400/30 underline-offset-2" : ""}
      `}
      title={revealed ? "Click for intel detail" : undefined}
      onClick={openPopup}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {text}{" "}
      {/* Tiny indicator dot on hover */}
      {hovered && revealed && (
        <span className="inline-block w-1 h-1 rounded-full bg-cyan-400/60 mb-0.5 align-middle" />
      )}
    </span>
  );
}

/* ──────────────────────────────────────────────────────────────────
   SECTION BLOCK
────────────────────────────────────────────────────────────────── */

const SECTION_ICON: Record<string, string> = {
  "Situation":            "◉",
  "Supply chain impact":  "⬡",
  "Recommended actions":  "⟶",
  "Confidence":           "◈",
};

interface SectionBlockProps {
  section:   Section;
  progress:  number;   // typewriter 0→1 over the whole text
  startFrac: number;   // fraction of total text where this section begins
  endFrac:   number;
  onOpen:    (popup: PopupData) => void;
  sources:   Source[];
}

function SectionBlock({
  section, progress, startFrac, endFrac, onOpen, sources,
}: SectionBlockProps) {
  const icon = SECTION_ICON[section.heading] ?? "▸";

  return (
    <div className="space-y-1">
      {section.heading && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-cyan-400/50 text-[11px]">{icon}</span>
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-400/60">
            {section.heading}
          </span>
          <div className="flex-1 h-px bg-cyan-400/10" />
        </div>
      )}
      <p className="text-[13px] leading-relaxed">
        {section.sentences.map((sentence, si) => {
          const sentFrac =
            startFrac + ((endFrac - startFrac) * si) / Math.max(section.sentences.length, 1);
          return (
            <SentenceRow
              key={si}
              text={sentence}
              revealed={progress >= sentFrac}
              onOpen={onOpen}
              sources={sources}
            />
          );
        })}
      </p>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   SOURCES STRIP — staggered cards that appear at ~60% progress
────────────────────────────────────────────────────────────────── */

function SourcesStrip({
  sources,
  visible,
}: {
  sources: Source[];
  visible: boolean;
}) {
  if (!visible || sources.length === 0) return null;
  return (
    <div className="mt-4 pt-3 border-t border-white/6 space-y-2">
      <div className="text-[8px] font-bold uppercase tracking-[0.2em] text-cyan-400/40">
        Intelligence sources
      </div>
      {sources.map((s, i) => (
        <SourceCard key={s.url ?? i} source={s} index={i} delay={i * 120} />
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   MAIN ExplanationPanel
────────────────────────────────────────────────────────────────── */

interface ExplanationPanelProps {
  explanation:  string;
  sources:      Source[];
  activeAgents: string[];
  durationMs:   number | null;
  /** Forward popup open requests to parent so popups render above everything */
  onOpenPopup:  (popup: PopupData) => void;
}

export default function ExplanationPanel({
  explanation,
  sources,
  activeAgents,
  durationMs,
  onOpenPopup,
}: ExplanationPanelProps) {
  const { displayed, done, progress } = useTypewriter(explanation, 3, 20);
  const sections = parseSections(displayed);
  const fullSections = parseSections(explanation);

  /* Compute each section's fractional span of the full text */
  const sectionMeta = fullSections.map((sec, i) => {
    const totalSentences = fullSections.reduce((n, s) => n + s.sentences.length, 0);
    const before = fullSections.slice(0, i).reduce((n, s) => n + s.sentences.length, 0);
    return {
      startFrac: totalSentences > 0 ? before / totalSentences : 0,
      endFrac:   totalSentences > 0 ? (before + sec.sentences.length) / totalSentences : 1,
    };
  });

  return (
    <HudPanel
      title="Supervisor"
      subtitle={durationMs !== null ? `${(durationMs / 1000).toFixed(1)}s` : undefined}
      accentColor="cyan"
      noPad
      className="w-[22rem] flex flex-col"
      style={{ maxHeight: "calc(100vh - 6rem)" }}
    >
      {/* ── Agent chips ─────────────────────────────────────────── */}
      {activeAgents.length > 0 && (
        <div className="flex flex-wrap gap-1 px-4 pt-3">
          {activeAgents.map((a) => (
            <span
              key={a}
              className="text-[8px] font-mono uppercase tracking-widest
                         border border-cyan-400/15 bg-cyan-400/5 text-cyan-300/60
                         rounded-full px-2 py-0.5"
            >
              {a}
            </span>
          ))}
        </div>
      )}

      {/* ── Streaming explanation ───────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 min-h-0">
        {sections.map((sec, i) => (
          <SectionBlock
            key={i}
            section={sec}
            progress={progress}
            startFrac={sectionMeta[i]?.startFrac ?? 0}
            endFrac={sectionMeta[i]?.endFrac ?? 1}
            onOpen={onOpenPopup}
            sources={sources}
          />
        ))}

        {/* Blinking cursor while typing */}
        {!done && (
          <span className="inline-block w-0.5 h-3.5 bg-cyan-400/70 blink align-middle" />
        )}
      </div>

      {/* ── Rich source cards (appear at 60% progress) ──────────── */}
      <div className="px-4 pb-4">
        <SourcesStrip sources={sources} visible={progress >= 0.55 || done} />
      </div>

      {/* ── Hint ────────────────────────────────────────────────── */}
      {done && sources.length > 0 && (
        <div className="px-4 pb-3 -mt-2">
          <p className="text-[9px] text-cyan-400/25 italic text-center">
            Click any sentence for intel detail
          </p>
        </div>
      )}
    </HudPanel>
  );
}
