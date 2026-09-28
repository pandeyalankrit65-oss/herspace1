import { isNative } from "./native";

// Listens for one phrase and returns what was heard (the recognizer's best guesses, best
// first). Uses the browser's Web Speech API, or the phone's own recognizer in the Android app.
// Used by voice commands and voice input in the support chat.

type RecognitionResultList = ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }>;
type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  lang: string;
  onresult: ((e: { resultIndex: number; results: RecognitionResultList }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  abort: () => void;
};
type RecognitionCtor = new () => Recognition;

const webRecognition = (): RecognitionCtor | undefined => {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as Record<string, RecognitionCtor | undefined>;
  return w.SpeechRecognition || w.webkitSpeechRecognition;
};

export const canListen = () => isNative || Boolean(webRecognition());

export type ListenError = "unsupported" | "blocked" | "noMic" | "network" | "nothing" | "other";
export class ListenFailed extends Error {
  constructor(public kind: ListenError) {
    super(kind);
  }
}

const FATAL: Record<string, ListenError> = {
  "not-allowed": "blocked",
  "service-not-allowed": "blocked",
  "audio-capture": "noMic",
  network: "network",
  "no-speech": "nothing",
};

export type Listening = { result: Promise<string[]>; stop: () => void };

export function listenOnce(locale: string, onPartial?: (text: string) => void): Listening {
  if (isNative) return listenNative(locale, onPartial);
  const Ctor = webRecognition();
  if (!Ctor) return { result: Promise.reject(new ListenFailed("unsupported")), stop: () => {} };

  const rec = new Ctor();
  rec.continuous = false;
  rec.interimResults = true;
  rec.maxAlternatives = 3;
  rec.lang = locale;
  let finished = false;
  const result = new Promise<string[]>((resolve, reject) => {
    let best: string[] = [];
    rec.onresult = (e) => {
      const last = e.results[e.results.length - 1];
      const alternatives = Array.from({ length: last.length }, (_, i) => last[i].transcript.trim()).filter(Boolean);
      if (alternatives.length) best = alternatives;
      onPartial?.(best[0] ?? "");
      if (last.isFinal) {
        finished = true;
        resolve(best);
        rec.abort();
      }
    };
    rec.onerror = (e) => {
      if (finished || e.error === "aborted") return;
      finished = true;
      reject(new ListenFailed(FATAL[e.error] ?? "other"));
    };
    rec.onend = () => {
      if (finished) return;
      finished = true;
      if (best.length) resolve(best);
      else reject(new ListenFailed("nothing"));
    };
  });
  try {
    rec.start();
  } catch {
    return { result: Promise.reject(new ListenFailed("other")), stop: () => {} };
  }
  return {
    result,
    stop: () => {
      try {
        rec.abort();
      } catch {
        // already stopped
      }
    },
  };
}

function listenNative(locale: string, onPartial?: (text: string) => void): Listening {
  let stopped = false;
  let stopNative = () => {};
  const result = (async () => {
    const { SpeechRecognition } = await import("@capacitor-community/speech-recognition");
    const { available } = await SpeechRecognition.available().catch(() => ({ available: false }));
    if (!available) throw new ListenFailed("unsupported");
    let permission = await SpeechRecognition.checkPermissions().catch(() => null);
    if (permission?.speechRecognition !== "granted") permission = await SpeechRecognition.requestPermissions().catch(() => null);
    if (permission?.speechRecognition !== "granted") throw new ListenFailed("blocked");
    if (stopped) throw new ListenFailed("nothing");
    const partial = await SpeechRecognition.addListener("partialResults", ({ matches }) => onPartial?.(matches?.[0] ?? ""));
    stopNative = () => {
      partial.remove();
      SpeechRecognition.stop().catch(() => {});
    };
    try {
      // Without partial results the call resolves with the final guesses.
      const { matches } = await SpeechRecognition.start({ language: locale, maxResults: 3, partialResults: false, popup: false });
      if (!matches?.length) throw new ListenFailed("nothing");
      return matches;
    } catch (err) {
      if (err instanceof ListenFailed) throw err;
      throw new ListenFailed(/permission/i.test(String((err as Error)?.message)) ? "blocked" : "nothing");
    } finally {
      partial.remove();
    }
  })();
  return {
    result,
    stop: () => {
      stopped = true;
      stopNative();
    },
  };
}
