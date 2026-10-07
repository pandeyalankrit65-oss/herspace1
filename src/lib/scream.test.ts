import { describe, expect, test } from "vitest";
import { analyse, COOLDOWN_MS, looksLikeScream, ScreamDetector, type Frame } from "./scream";

const scream: Frame = { db: -8, bandRatio: 0.8, centroid: 2200 };
const talking: Frame = { db: -30, bandRatio: 0.5, centroid: 700 };
const traffic: Frame = { db: -10, bandRatio: 0.2, centroid: 400 };
const quiet: Frame = { db: -60, bandRatio: 0, centroid: 0 };

function feed(d: ScreamDetector, frames: Frame[], start = 0, step = 50) {
  return frames.map((f, i) => d.push(f, start + i * step));
}

describe("scream detection", () => {
  test("a frame looks like a scream only if loud, high and in the scream band", () => {
    expect(looksLikeScream(scream)).toBe(true);
    expect(looksLikeScream(talking)).toBe(false);
    expect(looksLikeScream(traffic)).toBe(false);
    expect(looksLikeScream({ ...scream, db: -30 }), "too quiet").toBe(false);
    expect(looksLikeScream({ ...scream, db: -30 }, "high"), "but loud enough when more sensitive").toBe(true);
  });

  test("triggers after about 0.8 s of screaming, not on a short burst", () => {
    const d = new ScreamDetector();
    expect(feed(d, Array(10).fill(scream)).some(Boolean), "half a second").toBe(false);
    expect(feed(d, Array(30).fill(quiet), 500).some(Boolean)).toBe(false);
    const results = feed(d, Array(16).fill(scream), 2000);
    expect(results.indexOf(true)).toBe(15);
  });

  test("a scream broken by short gaps still counts; sounds spread out over time do not", () => {
    const d = new ScreamDetector();
    const broken = Array.from({ length: 24 }, (_, i) => (i % 4 === 3 ? quiet : scream));
    expect(feed(d, broken).some(Boolean)).toBe(true);
    const spread = new ScreamDetector();
    // One scream-like frame every 300 ms for 10 s never adds up within 1.5 s.
    expect(feed(spread, Array(34).fill(scream), 0, 300).some(Boolean)).toBe(false);
  });

  test("waits 15 seconds before it can trigger again", () => {
    const d = new ScreamDetector();
    expect(feed(d, Array(16).fill(scream)).some(Boolean)).toBe(true);
    expect(feed(d, Array(40).fill(scream), 1000).some(Boolean)).toBe(false);
    expect(feed(d, Array(16).fill(scream), COOLDOWN_MS + 1000).some(Boolean)).toBe(true);
  });

  test("more sensitive: quieter and shorter", () => {
    const d = new ScreamDetector("high");
    expect(feed(d, Array(10).fill({ ...scream, db: -30 })).some(Boolean)).toBe(true);
  });

  test("measures loudness, the scream band and the centre of the spectrum", () => {
    const samples = new Float32Array(2048).map((_, i) => 0.5 * Math.sin((2 * Math.PI * 2000 * i) / 48000));
    // A spectrum with its energy around 2 kHz (1024 bins up to 24 kHz: 23.4 Hz each).
    const spectrum = new Float32Array(1024).fill(-120);
    for (let i = 80; i <= 90; i++) spectrum[i] = -10;
    const f = analyse(samples, spectrum, 48000);
    expect(f.db).toBeCloseTo(-9, 0);
    expect(f.bandRatio).toBeGreaterThan(0.95);
    expect(f.centroid).toBeGreaterThan(1900);
    expect(f.centroid).toBeLessThan(2150);
    expect(analyse(new Float32Array(2048), spectrum.fill(-Infinity), 48000)).toEqual({ db: -Infinity, bandRatio: 0, centroid: 0 });
  });
});
