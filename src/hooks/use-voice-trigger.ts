import { useCallback, useEffect, useRef, useState } from "react";
import { isNative } from "@/lib/native";
import { speechLocale, type Lang } from "@/i18n";
import { SafeWordCounter } from "@/lib/safe-word";
import { heardCodePhrase } from "@/lib/codePhrase";

// Minimal typing for the Web Speech API, which isn't in TypeScript's DOM lib.
type RecognitionResultList = ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }>;
type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: { resultIndex: number; results: RecognitionResultList }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type RecognitionCtor = new () => Recognition;

const getRecognition = (): RecognitionCtor | undefined => {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as Record<string, RecognitionCtor | undefined>;
  return w.SpeechRecognition || w.webkitSpeechRecognition;
};

// Words that start the SOS countdown. The countdown can be cancelled, so this leans towards
// triggering: a missed call for help is worse than a cancelled false alarm. Chrome sometimes
// writes English words in Devanagari when listening in Hindi, hence "हेल्प".
// Tamil: உதவி (help), காப்பாத்து/காப்பாற்று (save me). Bengali: বাঁচাও (save me), সাহায্য (help).
// Marathi: वाचवा (save me), मदत (help).
const TRIGGER = /\bhelp\b|\bbachao\b|\bbachaao\b|बचाओ|बचाव|मदद|हेल्प|உதவி|காப்பா|বাঁচাও|বাচাও|সাহায্য|वाचवा|मदत/i;
export const isTriggerPhrase = (text: string) => TRIGGER.test(text);

// Errors after which retrying won't help; anything else (silence, a dropped session) restarts.
const FATAL: Record<string, VoiceError> = {
  "not-allowed": "blocked",
  "service-not-allowed": "blocked",
  "audio-capture": "noMic",
  network: "network",
};

export type VoiceError = "unsupported" | "blocked" | "noMic" | "network" | "other";
export type VoiceStatus = "idle" | "listening" | "error";

const RESTART_DELAY_MS = 300;
// Android's recognizer ends after each phrase or a few seconds of silence, and doesn't always
// say so; check this often that it's still listening.
const NATIVE_CHECK_MS = 2000;

/**
 * Listens continuously for a call for help and calls `onTrigger` once when it hears one: one of
 * the built-in words (unless `helpWords` is off), or the user's safe word said 3 times quickly.
 * Her code phrase, said once, calls `onCodePhrase` instead (a silent SOS, straight away).
 * Only works while the page is open and visible; browsers stop recognition in the background.
 */
export function useVoiceTrigger({
  lang,
  onTrigger,
  safeWord = null,
  helpWords = true,
  codePhrase = null,
  onCodePhrase,
}: {
  lang: Lang;
  onTrigger: () => void;
  safeWord?: string | null;
  helpWords?: boolean;
  codePhrase?: string | null;
  onCodePhrase?: () => void;
}) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [error, setError] = useState<VoiceError | null>(null);
  const [errorDetail, setErrorDetail] = useState("");
  const [heard, setHeard] = useState("");
  const recRef = useRef<Recognition | null>(null);
  const wantRef = useRef(false);
  const timerRef = useRef<number>();
  const onTriggerRef = useRef(onTrigger);
  onTriggerRef.current = onTrigger;
  const nativeStopRef = useRef<(() => void) | null>(null);
  // Read at the moment something is heard, so changing the settings needs no restart.
  const helpWordsRef = useRef(helpWords);
  helpWordsRef.current = helpWords;
  const codePhraseRef = useRef({ phrase: codePhrase, onHeard: onCodePhrase });
  codePhraseRef.current = { phrase: codePhrase, onHeard: onCodePhrase };
  const counterRef = useRef<{ word: string; counter: SafeWordCounter } | null>(null);
  if ((counterRef.current?.word ?? null) !== safeWord) {
    counterRef.current = safeWord ? { word: safeWord, counter: new SafeWordCounter(safeWord) } : null;
  }
  const sessionRef = useRef(0);

  const cleanup = useCallback(() => {
    wantRef.current = false;
    window.clearTimeout(timerRef.current);
    nativeStopRef.current?.();
    nativeStopRef.current = null;
    const rec = recRef.current;
    recRef.current = null;
    if (rec) {
      rec.onend = null;
      rec.onerror = null;
      rec.onresult = null;
      try {
        rec.abort();
      } catch {
        // already stopped
      }
    }
  }, []);

  const stop = useCallback(() => {
    cleanup();
    setStatus("idle");
  }, [cleanup]);

  const fail = useCallback(
    (kind: VoiceError, detail = "") => {
      cleanup();
      setError(kind);
      setErrorDetail(detail);
      setStatus("error");
    },
    [cleanup]
  );

  // Checks what was heard (all of the recognizer's guesses) and triggers at most once.
  // `session` identifies one recognition session; `transcripts` is everything heard in it so
  // far (used to count the safe word without counting the same word twice).
  const handleHeard = useCallback(
    (candidates: string[], session = sessionRef.current, transcripts = candidates) => {
      const text = candidates[0]?.trim();
      if (!text) return;
      setHeard(text);
      const code = codePhraseRef.current;
      if (code.onHeard && heardCodePhrase(candidates, code.phrase)) {
        stop();
        code.onHeard();
        return;
      }
      const byHelpWord = helpWordsRef.current && candidates.some(isTriggerPhrase);
      const bySafeWord = counterRef.current?.counter.update(session, transcripts) ?? false;
      if (byHelpWord || bySafeWord) {
        // One trigger per session: stop listening so continued speech can't start a second alert.
        stop();
        onTriggerRef.current();
      }
    },
    [stop]
  );

  // In the Android app, WebView has no Web Speech API: use the phone's own speech recognizer.
  const startNative = useCallback(async () => {
    const { SpeechRecognition } = await import("@capacitor-community/speech-recognition");
    const { available } = await SpeechRecognition.available().catch(() => ({ available: false }));
    if (!available) return fail("unsupported");
    let permission = await SpeechRecognition.checkPermissions().catch(() => null);
    if (permission?.speechRecognition !== "granted") permission = await SpeechRecognition.requestPermissions().catch(() => null);
    if (permission?.speechRecognition !== "granted") return fail("blocked");
    if (!wantRef.current) return;

    const language = lang === "en" ? navigator.language || "en-IN" : speechLocale(lang);
    let lastLaunch = 0;
    const launch = () => {
      // Starting again while the previous session is still closing makes the recognizer busy.
      if (!wantRef.current || Date.now() - lastLaunch < 1000) return;
      lastLaunch = Date.now();
      sessionRef.current++;
      SpeechRecognition.start({ language, partialResults: true, popup: false, maxResults: 5 }).catch((err: Error) => {
        if (/permission/i.test(err?.message || "")) fail("blocked");
      });
    };

    const handles = await Promise.all([
      SpeechRecognition.addListener("partialResults", ({ matches }) => handleHeard(matches ?? [])),
      SpeechRecognition.addListener("listeningState", ({ status }) => {
        if (status === "stopped") timerRef.current = window.setTimeout(launch, RESTART_DELAY_MS);
      }),
    ]);
    const check = window.setInterval(() => {
      SpeechRecognition.isListening()
        .then(({ listening }) => !listening && launch())
        .catch(() => {});
    }, NATIVE_CHECK_MS);
    const stopNative = () => {
      window.clearInterval(check);
      handles.forEach((h) => h.remove());
      SpeechRecognition.stop().catch(() => {});
    };
    if (!wantRef.current) return stopNative(); // stopped while we were asking for permission
    nativeStopRef.current = stopNative;
    launch();
  }, [lang, fail, handleHeard]);

  const start = useCallback(() => {
    if (isNative) {
      cleanup();
      setError(null);
      setHeard("");
      wantRef.current = true;
      setStatus("listening");
      startNative().catch((err) => fail("other", err instanceof Error ? err.message : String(err)));
      return;
    }
    const Ctor = getRecognition();
    if (!Ctor) return fail("unsupported");
    cleanup();
    setError(null);
    setHeard("");
    wantRef.current = true;

    let recognitionLang = lang === "en" ? navigator.language || "en-US" : speechLocale(lang);

    const launch = () => {
      if (!wantRef.current) return;
      const rec = new Ctor();
      const session = ++sessionRef.current;
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = recognitionLang;

      rec.onresult = (e) => {
        let text = "";
        for (let i = e.resultIndex; i < e.results.length; i++) text += e.results[i][0].transcript;
        let all = "";
        for (let i = 0; i < e.results.length; i++) all += ` ${e.results[i][0].transcript}`;
        handleHeard([text], session, [all]);
      };

      rec.onerror = (e) => {
        if (e.error === "language-not-supported" && recognitionLang !== "en-US") {
          recognitionLang = "en-US"; // fall back and let onend restart
          return;
        }
        const fatal = FATAL[e.error];
        if (fatal) fail(fatal);
        else if (e.error !== "no-speech" && e.error !== "aborted") console.warn("Speech recognition error:", e.error);
      };

      // Browsers end a session after silence or a while of speech; start a fresh one.
      rec.onend = () => {
        if (!wantRef.current) return;
        timerRef.current = window.setTimeout(launch, RESTART_DELAY_MS);
      };

      recRef.current = rec;
      try {
        rec.start();
      } catch (err) {
        fail("other", err instanceof Error ? err.message : String(err));
      }
    };

    launch();
    setStatus("listening");
  }, [lang, cleanup, fail, handleHeard, startNative]);

  // Stop when leaving the page; restart in the new language if it changes mid-session.
  useEffect(() => cleanup, [cleanup]);
  useEffect(() => {
    if (wantRef.current) start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  return { supported: isNative || Boolean(getRecognition()), status, error, errorDetail, heard, start, stop };
}
