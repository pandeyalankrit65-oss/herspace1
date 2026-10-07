import { useEffect, useRef, useState } from "react";
import { vibrate } from "@/lib/disguise";
import { analyse, looksLikeScream, ScreamDetector, type Sensitivity } from "@/lib/scream";

const ENABLED_KEY = "herspace_scream";
const SENSITIVITY_KEY = "herspace_scream_sensitivity";
const FRAME_MS = 50;

export type ScreamStatus = "off" | "starting" | "listening" | "denied" | "unsupported" | "error";

export const screamSupported = () =>
  typeof window !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia) && ("AudioContext" in window || "webkitAudioContext" in window);

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // private mode: lasts for this visit only
  }
};

/**
 * Starts the SOS countdown when a long, loud scream is heard, if the user turned it on. Like
 * the voice and shake triggers, it only works while the page is open. In test mode it shows the
 * level and whether a scream would count, without starting anything.
 */
export function useScreamTrigger(onScream: () => void) {
  const [enabled, setEnabledState] = useState(() => read(ENABLED_KEY) === "1");
  const [sensitivity, setSensitivityState] = useState<Sensitivity>(() => (read(SENSITIVITY_KEY) === "high" ? "high" : "normal"));
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<ScreamStatus>("off");
  // 0..1 loudness for the test meter, and whether the current sound would count.
  const [level, setLevel] = useState(0);
  const [screamy, setScreamy] = useState(false);
  const [heardInTest, setHeardInTest] = useState(false);
  const onScreamRef = useRef(onScream);
  onScreamRef.current = onScream;
  const testingRef = useRef(testing);
  testingRef.current = testing;

  const setEnabled = (on: boolean) => {
    setEnabledState(on);
    write(ENABLED_KEY, on ? "1" : "0");
    if (!on) setTesting(false);
  };
  const setSensitivity = (s: Sensitivity) => {
    setSensitivityState(s);
    write(SENSITIVITY_KEY, s);
  };

  const active = enabled || testing;

  useEffect(() => {
    if (!active) {
      setStatus("off");
      return;
    }
    if (!screamSupported()) {
      setStatus("unsupported");
      return;
    }
    let stopped = false;
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    let timer = 0;
    setStatus("starting");
    (async () => {
      try {
        // Raw sound: noise suppression and automatic gain would flatten exactly what we measure.
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
        if (stopped) return stream.getTracks().forEach((t) => t.stop());
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        ctx = new Ctx();
        await ctx.resume().catch(() => {});
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const samples = new Float32Array(analyser.fftSize);
        const spectrum = new Float32Array(analyser.frequencyBinCount);
        const detector = new ScreamDetector(sensitivity, FRAME_MS);
        setStatus("listening");
        timer = window.setInterval(() => {
          analyser.getFloatTimeDomainData(samples);
          analyser.getFloatFrequencyData(spectrum);
          const frame = analyse(samples, spectrum, ctx!.sampleRate);
          setLevel(Math.max(0, Math.min(1, (frame.db + 60) / 60)));
          setScreamy(looksLikeScream(frame, sensitivity));
          if (detector.push(frame, Date.now())) {
            vibrate(200);
            if (testingRef.current) setHeardInTest(true);
            else onScreamRef.current();
          }
        }, FRAME_MS);
      } catch (err) {
        if (stopped) return;
        setStatus(err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "SecurityError") ? "denied" : "error");
      }
    })();
    return () => {
      stopped = true;
      window.clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
      ctx?.close().catch(() => {});
      setLevel(0);
      setScreamy(false);
    };
    // Restarting when a test ends gives a fresh detector, so a test scream's pause never delays a real one.
  }, [active, sensitivity, testing]);

  const startTest = () => {
    setHeardInTest(false);
    setTesting(true);
  };
  const stopTest = () => setTesting(false);

  return {
    supported: screamSupported(),
    enabled,
    setEnabled,
    sensitivity,
    setSensitivity,
    status,
    testing,
    startTest,
    stopTest,
    level,
    screamy,
    heardInTest,
  };
}
