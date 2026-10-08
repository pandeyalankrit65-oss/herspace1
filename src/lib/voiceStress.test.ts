import { describe, expect, test } from "vitest";
import { ASK_AGAIN_MS, estimatePitch, makeBaseline, StressDetector, voiceFrame, type VoiceFrame } from "./voiceStress";

const RATE = 16000;
// A voice-like tone: a fundamental plus two harmonics.
const tone = (hz: number, amp = 0.3, n = 1024) =>
  new Float32Array(n).map((_, i) => {
    const t = (2 * Math.PI * hz * i) / RATE;
    return amp * (Math.sin(t) + 0.5 * Math.sin(2 * t) + 0.25 * Math.sin(3 * t));
  });

const calm = (i: number): VoiceFrame => ({ db: -24 + (i % 3), pitch: 200 + ((i * 7) % 20) - 10 });

describe("voice stress (experimental)", () => {
  test("finds the pitch of a voiced sound, and none in silence or noise", () => {
    expect(estimatePitch(tone(200), RATE)).toBeGreaterThan(190);
    expect(estimatePitch(tone(200), RATE)).toBeLessThan(210);
    expect(estimatePitch(tone(320), RATE)).toBeCloseTo(320, -1);
    expect(estimatePitch(new Float32Array(1024), RATE)).toBeNull();
    let seed = 1;
    const noise = new Float32Array(1024).map(() => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 0.6);
    expect(estimatePitch(noise, RATE)).toBeNull();
    expect(voiceFrame(tone(200, 0.001), RATE).pitch, "too quiet to judge").toBeNull();
  });

  test("a baseline needs about 2 seconds of voice", () => {
    expect(makeBaseline(Array.from({ length: 30 }, (_, i) => calm(i)))).toBeNull();
    const b = makeBaseline(Array.from({ length: 60 }, (_, i) => calm(i)))!;
    expect(b.pitchMean).toBeCloseTo(200, -1);
  });

  test("asks only when she sounds clearly higher and louder than her own calm voice, then waits a minute", () => {
    const baseline = makeBaseline(Array.from({ length: 60 }, (_, i) => calm(i)))!;
    const d = new StressDetector(baseline);
    // Her normal voice for 6 seconds: nothing.
    for (let i = 0; i < 120; i++) expect(d.push(calm(i), i * 50)).toBe(false);
    // Higher and louder.
    const results = Array.from({ length: 120 }, (_, i) => d.push({ db: -14, pitch: 290 + (i % 5) }, 6000 + i * 50));
    expect(results.some(Boolean)).toBe(true);
    // Not again within a minute.
    const again = Array.from({ length: 200 }, (_, i) => d.push({ db: -14, pitch: 290 }, 12_000 + i * 50));
    expect(again.some(Boolean)).toBe(false);
    expect(Array.from({ length: 60 }, (_, i) => d.push({ db: -14, pitch: 290 }, 6000 + ASK_AGAIN_MS + 1000 + i * 50)).some(Boolean)).toBe(true);
  });

  test("only higher, but not louder or unsteadier, is not enough", () => {
    const baseline = makeBaseline(Array.from({ length: 60 }, (_, i) => calm(i)))!;
    const d = new StressDetector(baseline);
    expect(Array.from({ length: 200 }, (_, i) => d.push({ db: -24, pitch: 290 }, i * 50)).some(Boolean)).toBe(false);
  });
});
