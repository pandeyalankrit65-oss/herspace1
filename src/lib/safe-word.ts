import { useState } from "react";

// A personal safe word for the voice trigger: saying it 3 times in quick succession starts the
// SOS countdown. Saying it once or twice (in normal conversation) does nothing. It's kept only
// on this device, like the other discreet settings.

const WORD_KEY = "herspace_safe_word";
const HELP_KEY = "herspace_help_words";
export const SAFE_WORD_REPEATS = 3;
export const SAFE_WORD_WINDOW_MS = 10_000;

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // storage blocked: the setting lasts for this visit only
  }
};

export type SafeWordSettings = { word: string | null; helpWords: boolean };

export function useSafeWord() {
  const [settings, setSettings] = useState<SafeWordSettings>(() => ({
    word: read(WORD_KEY),
    // The built-in "help" words stay on unless turned off (only possible with a safe word set).
    helpWords: read(HELP_KEY) !== "0",
  }));
  const save = (next: SafeWordSettings) => {
    const word = next.word?.trim() || null;
    write(WORD_KEY, word);
    write(HELP_KEY, word && !next.helpWords ? "0" : null);
    setSettings({ word, helpWords: !word || next.helpWords });
  };
  return { ...settings, save };
}

const normalize = (text: string) => text.toLowerCase().replace(/[.,!?;:।॥"“”'’()-]/g, " ").replace(/\s+/g, " ").trim();

// How many times the word occurs in the text. Latin words must match whole words; words in
// Indian scripts are matched as substrings (the recognizer may join them to the next word).
export function countWord(text: string, word: string): number {
  const w = normalize(word);
  const t = normalize(text);
  if (!w || !t) return 0;
  if (/^[a-z0-9 ]+$/.test(w)) {
    const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return t.match(new RegExp(`\\b${escaped}\\b`, "g"))?.length ?? 0;
  }
  return t.split(w).length - 1;
}

/**
 * Counts safe-word occurrences across recognition sessions. The recognizer reports the whole
 * transcript of a session again and again as it grows, so each session's count is remembered
 * and only new occurrences are timestamped.
 */
export class SafeWordCounter {
  private hits: number[] = [];
  private seen = new Map<number, number>();

  constructor(
    private word: string,
    private needed = SAFE_WORD_REPEATS,
    private windowMs = SAFE_WORD_WINDOW_MS
  ) {}

  // Returns true when the word has been said `needed` times within the window.
  update(session: number, transcripts: string[], now = Date.now()): boolean {
    const total = Math.max(0, ...transcripts.map((t) => countWord(t, this.word)));
    const before = this.seen.get(session) ?? 0;
    if (total > before) {
      for (let i = before; i < total; i++) this.hits.push(now);
      this.seen.set(session, total);
    }
    this.hits = this.hits.filter((t) => now - t <= this.windowMs);
    if (this.hits.length < this.needed) return false;
    this.hits = [];
    return true;
  }
}
