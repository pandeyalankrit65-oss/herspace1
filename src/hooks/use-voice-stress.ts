import { useEffect, useRef, useState } from "react";
import { vibrate } from "@/lib/disguise";
import { keepAudioRunning } from "@/lib/audio";
import { makeBaseline, StressDetector, voiceFrame, type Baseline, type VoiceFrame } from "@/lib/voiceStress";

const ENABLED_KEY = "herspace_voice_stress";
const BASELINE_KEY = "herspace_voice_baseline";
const FRAME_MS = 100;
const RATE = 16000; // analysed at 16 kHz: plenty for a voice, light on older phones
export const CALIBRATE_MS = 10_000;

export type StressStatus = "off" | "starting" | "listening" | "needsTap" | "denied" | "unsupported" | "error";

export const voiceStressSupported = () =>
  typeof window !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia) && ("AudioContext" in window || "webkitAudioContext" in window);

const readBaseline = (): Baseline | null => {
  try {
    const b = JSON.parse(localStorage.getItem(BASELINE_KEY) ?? "null") as Baseline | null;
    return b && [b.pitchMean, b.pitchSd, b.dbMean, b.dbSd].every(Number.isFinite) ? b : null;
  } catch {
    return null;
  }
};
const store = (key: string, value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // private mode: lasts for this visit only
  }
};

// Every nth sample, so the pitch search runs at about 16 kHz whatever the microphone's rate.
const downsample = (samples: Float32Array, factor: number) =>
  factor <= 1 ? samples : Float32Array.from({ length: Math.floor(samples.length / factor) }, (_, i) => samples[i * factor]);

/**
 * Experimental: while the SOS page is open, compares her voice with her own calm baseline and
 * asks "are you okay?" when she sounds clearly stressed. It never starts SOS by itself.
 */
export function useVoiceStress() {
  const [enabled, setEnabledState] = useState(() => {
    try {
      return localStorage.getItem(ENABLED_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [baseline, setBaseline] = useState<Baseline | null>(readBaseline);
  const [calibrating, setCalibrating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [calibrationFailed, setCalibrationFailed] = useState(false);
  const [status, setStatus] = useState<StressStatus>("off");
  const [asked, setAsked] = useState(false);
  const calibrationFrames = useRef<VoiceFrame[]>([]);

  const setEnabled = (on: boolean) => {
    setEnabledState(on);
    store(ENABLED_KEY, on ? "1" : "0");
    if (!on) setAsked(false);
  };
  const forget = () => {
    store(BASELINE_KEY, null);
    setBaseline(null);
  };
  const calibrate = () => {
    calibrationFrames.current = [];
    setCalibrationFailed(false);
    setProgress(0);
    setCalibrating(true);
  };

  const active = calibrating || (enabled && baseline !== null);

  useEffect(() => {
    if (!active) {
      setStatus("off");
      return;
    }
    if (!voiceStressSupported()) {
      setStatus("unsupported");
      setCalibrating(false);
      return;
    }
    let stopped = false;
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    let timer = 0;
    let releaseAudio = () => {};
    setStatus("starting");
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
        if (stopped) return stream.getTracks().forEach((t) => t.stop());
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        ctx = new Ctx();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 4096;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const samples = new Float32Array(analyser.fftSize);
        const factor = Math.max(1, Math.round(ctx.sampleRate / RATE));
        const rate = ctx.sampleRate / factor;
        const detector = baseline ? new StressDetector(baseline) : null;
        const started = Date.now();
        // Listening only once the browser really lets audio run (after a tap, after a reload).
        releaseAudio = keepAudioRunning(ctx, (running) => !stopped && setStatus(running ? "listening" : "needsTap"));
        timer = window.setInterval(() => {
          analyser.getFloatTimeDomainData(samples);
          const frame = voiceFrame(downsample(samples, factor), rate);
          if (calibrating) {
            calibrationFrames.current.push(frame);
            const done = Math.min(1, (Date.now() - started) / CALIBRATE_MS);
            setProgress(done);
            if (done >= 1) {
              const b = makeBaseline(calibrationFrames.current);
              if (b) {
                store(BASELINE_KEY, JSON.stringify(b));
                setBaseline(b);
              } else setCalibrationFailed(true);
              setCalibrating(false);
            }
          } else if (detector?.push(frame, Date.now())) {
            vibrate([100, 80, 100]);
            setAsked(true);
          }
        }, FRAME_MS);
      } catch (err) {
        if (stopped) return;
        setCalibrating(false);
        setStatus(err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "SecurityError") ? "denied" : "error");
      }
    })();
    return () => {
      stopped = true;
      window.clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
      releaseAudio();
      ctx?.close().catch(() => {});
    };
  }, [active, calibrating, baseline]);

  return {
    supported: voiceStressSupported(),
    enabled,
    setEnabled,
    baseline,
    calibrate,
    calibrating,
    progress,
    calibrationFailed,
    forget,
    status,
    asked,
    dismiss: () => setAsked(false),
  };
}
