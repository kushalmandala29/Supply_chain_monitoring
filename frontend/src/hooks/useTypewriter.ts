import { useEffect, useState } from "react";

/**
 * Fakes streaming generation by revealing `text` character-by-character.
 * Speed is tuned to feel like a fast LLM stream (~120 chars/sec default).
 */
export function useTypewriter(text: string, charsPerTick = 3, tickMs = 22) {
  const [cursor, setCursor] = useState(0);

  // Reset whenever the source text changes (new query response)
  useEffect(() => {
    setCursor(0);
  }, [text]);

  useEffect(() => {
    if (cursor >= text.length) return;
    const id = setTimeout(
      () => setCursor((c) => Math.min(c + charsPerTick, text.length)),
      tickMs,
    );
    return () => clearTimeout(id);
  }, [cursor, text, charsPerTick, tickMs]);

  return {
    displayed: text.slice(0, cursor),
    done: cursor >= text.length && text.length > 0,
    /** 0→1 fraction, useful for staggering children */
    progress: text.length > 0 ? cursor / text.length : 1,
  };
}
