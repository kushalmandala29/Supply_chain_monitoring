import HudPanel from "./HudPanel";

/* ──────────────────────────────────────────────────────────────────
   SECTION PARSER
   Splits "Situation:\n...\nSupply-chain impact:\n..." into labelled
   sections, then further into individual highlight lines.
────────────────────────────────────────────────────────────────── */

interface Section {
  heading: string;
  sentences: string[];
}

// The synthesizer writes short bullet highlights, and inconsistently marks
// section headings as "- Situation:", "### Situation", or markdown-bold
// "**Situation**" -- stripping "**...**" globally first (turning
// "**Situation**" into a bare "Situation") means the split/heading regexes
// below only need to handle one leading bullet marker, not markdown bold too.
function stripMarkdownBold(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "$1");
}

const SECTION_SPLIT_RE =
  /\n+(?=[-*•]?\s*(?:Situation|Supply[- ]chain impact|Recommended actions?|Confidence)[:\s–-])/gi;
const SECTION_HEADING_RE =
  /^[-*•]?\s*(#{1,3}\s*)?(Situation|Supply[- ]chain impact|Recommended actions?|Confidence)[:\s–-]+/i;

function parseSentences(text: string): string[] {
  // Split by line first (the synthesizer writes one short, often indented,
  // bullet per line) and strip the leading "- "/"*"/"•" marker -- each
  // bullet already reads as its own highlight once on its own line, so the
  // raw marker is just noise. Falls back to sentence-boundary splitting
  // within a line for any line that packs more than one sentence.
  return text
    .split(/\n+/)
    .flatMap((line) => (line.trim() ? line.split(/(?<=[.!?])\s+/) : []))
    .map((s) => s.replace(/^\s*[-*•]\s*/, "").trim())
    .filter((s) => s.length > 4);
}

function parseSections(text: string): Section[] {
  const clean = stripMarkdownBold(text);
  const raw = clean.split(SECTION_SPLIT_RE);
  if (raw.length < 2)
    return [{ heading: "", sentences: parseSentences(clean.trim()) }];

  return raw.map((chunk) => {
    const m = chunk.match(SECTION_HEADING_RE);
    if (!m) return { heading: "", sentences: parseSentences(chunk.trim()) };
    const heading = m[2].replace(/[-_]/g, " ");
    const body    = chunk.slice(m[0].length).trim();
    return { heading, sentences: parseSentences(body) };
  });
}

/* ──────────────────────────────────────────────────────────────────
   SECTION BLOCK — plain highlight lines, no click interaction.
   Sources/imagery now auto-popup from AppShell the moment they're
   ready instead of requiring a click on any particular sentence.
────────────────────────────────────────────────────────────────── */

const SECTION_ICON: Record<string, string> = {
  "Situation":            "◉",
  "Supply chain impact":  "⬡",
  "Recommended actions":  "⟶",
  "Confidence":           "◈",
};

function SectionBlock({ section }: { section: Section }) {
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
      <ul className="space-y-1">
        {section.sentences.map((sentence, si) => (
          <li key={si} className="text-[13px] leading-relaxed text-cyan-100/90 flex gap-2">
            <span className="text-cyan-400/30 shrink-0">·</span>
            <span>{sentence}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   MAIN ExplanationPanel
────────────────────────────────────────────────────────────────── */

interface ExplanationPanelProps {
  explanation:  string;
  activeAgents: string[];
  durationMs:   number | null;
}

export default function ExplanationPanel({
  explanation,
  activeAgents,
  durationMs,
}: ExplanationPanelProps) {
  const sections = parseSections(explanation);
  // durationMs is only set once the final explanation_updated event arrives
  // (see useStore.ts) -- until then, chunks are still streaming in.
  const streaming = durationMs === null;

  return (
    <HudPanel
      title="Synthesizer"
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
          <SectionBlock key={i} section={sec} />
        ))}

        {/* Blinking cursor while chunks are still arriving */}
        {streaming && (
          <span className="inline-block w-0.5 h-3.5 bg-cyan-400/70 blink align-middle" />
        )}
      </div>
    </HudPanel>
  );
}
