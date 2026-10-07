// Scream detection for the SOS page. Sound is analysed on the phone, frame by frame, and never
// recorded or sent. A scream is loud, sustained, and high: most of its energy sits between about
// 0.7 and 4 kHz, unlike a slammed door (short), traffic (low) or talking (quieter).

export type Frame = { db: number; bandRatio: number; centroid: number };
export type Sensitivity = "normal" | "high";

const SETTINGS: Record<Sensitivity, { minDb: number; needMs: number }> = {
  normal: { minDb: -26, needMs: 800 },
  high: { minDb: -32, needMs: 500 },
};
const WINDOW_MS = 1500;
const MIN_BAND_RATIO = 0.55;
const MIN_CENTROID_HZ = 900;
export const COOLDOWN_MS = 15_000;

const BAND_LOW = 700;
const BAND_HIGH = 4000;
const SPEECH_LOW = 100;
const SPEECH_HIGH = 8000;

// One frame's features, from an AnalyserNode's time-domain samples and frequency spectrum (dB).
export function analyse(samples: Float32Array, spectrumDb: Float32Array, sampleRate: number): Frame {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  const rms = Math.sqrt(sum / Math.max(1, samples.length));
  const db = rms > 0 ? 20 * Math.log10(rms) : -Infinity;

  const binHz = sampleRate / 2 / spectrumDb.length;
  let total = 0;
  let band = 0;
  let weighted = 0;
  for (let i = 0; i < spectrumDb.length; i++) {
    const hz = i * binHz;
    if (hz < SPEECH_LOW || hz > SPEECH_HIGH || !Number.isFinite(spectrumDb[i])) continue;
    const power = Math.pow(10, spectrumDb[i] / 10);
    total += power;
    weighted += power * hz;
    if (hz >= BAND_LOW && hz <= BAND_HIGH) band += power;
  }
  return { db, bandRatio: total > 0 ? band / total : 0, centroid: total > 0 ? weighted / total : 0 };
}

export const looksLikeScream = (f: Frame, sensitivity: Sensitivity = "normal") =>
  f.db >= SETTINGS[sensitivity].minDb && f.bandRatio >= MIN_BAND_RATIO && f.centroid >= MIN_CENTROID_HZ;

// Feeds frames in time order; says when enough of the last 1.5 s sounded like a scream.
export class ScreamDetector {
  private hits: number[] = [];
  private cooldownUntil = 0;

  constructor(
    private sensitivity: Sensitivity = "normal",
    private frameMs = 50,
  ) {}

  push(frame: Frame, now: number): boolean {
    if (now < this.cooldownUntil) return false;
    this.hits = this.hits.filter((t) => now - t < WINDOW_MS);
    if (looksLikeScream(frame, this.sensitivity)) this.hits.push(now);
    if (this.hits.length * this.frameMs >= SETTINGS[this.sensitivity].needMs) {
      this.hits = [];
      this.cooldownUntil = now + COOLDOWN_MS;
      return true;
    }
    return false;
  }
}
