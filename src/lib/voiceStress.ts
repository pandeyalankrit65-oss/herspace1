// Experimental: noticing stress in her voice, compared with her own calm voice. Voice stress
// detection is unreliable (accents, languages, colds, a noisy street), so this only ever asks
// "are you okay?"; it never starts SOS by itself. Sound is analysed on the phone and never
// recorded or sent; the baseline is four numbers kept on the phone.

export type Baseline = { pitchMean: number; pitchSd: number; dbMean: number; dbSd: number };
export type VoiceFrame = { db: number; pitch: number | null };

const MIN_HZ = 80;
const MAX_HZ = 450;
const MIN_DB = -45; // quieter than this is not speech worth judging
const MIN_CLARITY = 0.6;

// Fundamental frequency by normalised autocorrelation, or null if the frame isn't clearly voiced.
export function estimatePitch(samples: Float32Array, sampleRate: number): number | null {
  const n = samples.length;
  const corr = (lag: number) => {
    let sum = 0;
    let e1 = 0;
    let e2 = 0;
    for (let i = 0; i + lag < n; i++) {
      sum += samples[i] * samples[i + lag];
      e1 += samples[i] * samples[i];
      e2 += samples[i + lag] * samples[i + lag];
    }
    return e1 && e2 ? sum / Math.sqrt(e1 * e2) : 0;
  };
  const minLag = Math.floor(sampleRate / MAX_HZ);
  const maxLag = Math.min(n - 2, Math.ceil(sampleRate / MIN_HZ));
  let lag = -1;
  let best = 0;
  for (let l = minLag; l <= maxLag; l++) {
    const r = corr(l);
    if (r > best) {
      best = r;
      lag = l;
    }
  }
  if (lag < 0 || best < MIN_CLARITY) return null;
  // A period two or three times too long matches almost as well; prefer the true one.
  for (const k of [3, 2]) {
    const shorter = Math.round(lag / k);
    if (shorter >= minLag && corr(shorter) >= best * 0.9) {
      lag = shorter;
      break;
    }
  }
  // Refine between whole samples (parabolic interpolation around the peak).
  const [a, b, c] = [corr(lag - 1), corr(lag), corr(lag + 1)];
  const shift = a - 2 * b + c === 0 ? 0 : (0.5 * (a - c)) / (a - 2 * b + c);
  return sampleRate / (lag + Math.max(-0.5, Math.min(0.5, shift)));
}

export function voiceFrame(samples: Float32Array, sampleRate: number): VoiceFrame {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  const rms = Math.sqrt(sum / Math.max(1, samples.length));
  const db = rms > 0 ? 20 * Math.log10(rms) : -Infinity;
  return { db, pitch: db >= MIN_DB ? estimatePitch(samples, sampleRate) : null };
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};

// At least ~2 seconds of voiced sound are needed for a usable baseline.
export const MIN_BASELINE_FRAMES = 40;

export function makeBaseline(frames: VoiceFrame[]): Baseline | null {
  const voiced = frames.filter((f): f is { db: number; pitch: number } => f.pitch !== null);
  if (voiced.length < MIN_BASELINE_FRAMES) return null;
  const pitches = voiced.map((f) => f.pitch);
  const dbs = voiced.map((f) => f.db);
  return { pitchMean: mean(pitches), pitchSd: sd(pitches), dbMean: mean(dbs), dbSd: sd(dbs) };
}

const WINDOW_MS = 6000;
const MIN_WINDOW_FRAMES = 30;
export const ASK_AGAIN_MS = 60_000;

// Clearly higher than her usual pitch, and either louder or much more unsteady, for a while.
export class StressDetector {
  private frames: Array<{ at: number; db: number; pitch: number }> = [];
  private quietUntil = 0;

  constructor(private baseline: Baseline) {}

  push(frame: VoiceFrame, now: number): boolean {
    if (frame.pitch !== null) this.frames.push({ at: now, db: frame.db, pitch: frame.pitch });
    this.frames = this.frames.filter((f) => now - f.at < WINDOW_MS);
    if (now < this.quietUntil || this.frames.length < MIN_WINDOW_FRAMES) return false;
    const b = this.baseline;
    const pitches = this.frames.map((f) => f.pitch);
    const zPitch = (mean(pitches) - b.pitchMean) / Math.max(b.pitchSd, 10);
    const zLoud = (mean(this.frames.map((f) => f.db)) - b.dbMean) / Math.max(b.dbSd, 3);
    const unsteady = sd(pitches) / Math.max(b.pitchSd, 10);
    if (zPitch >= 1.5 && (zLoud >= 1 || unsteady >= 1.5)) {
      this.frames = [];
      this.quietUntil = now + ASK_AGAIN_MS;
      return true;
    }
    return false;
  }
}
