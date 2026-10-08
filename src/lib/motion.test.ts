import { describe, expect, test } from "vitest";
import { compassOf, motionBetween, paceOf } from "./motion";

const start = { lat: 22.5, lng: 88.3, accuracy: 10 };

describe("motion between two positions", () => {
  test("walking north", () => {
    // About 111 m north in 80 s.
    const m = motionBetween({ coords: start, at: 0 }, { lat: 22.501, lng: 88.3, accuracy: 10 }, 80_000)!;
    expect(m.speed).toBeCloseTo(1.4, 1);
    expect(compassOf(m.heading!)).toBe("n");
    expect(paceOf(m.speed)).toBe("walking");
  });

  test("a move within the GPS uncertainty counts as standing still", () => {
    expect(motionBetween({ coords: start, at: 0 }, { lat: 22.5002, lng: 88.3, accuracy: 40 }, 10_000)).toEqual({ speed: 0, heading: null });
  });

  test("too long a gap says nothing", () => {
    expect(motionBetween({ coords: start, at: 0 }, { lat: 22.51, lng: 88.3 }, 10 * 60_000)).toBeUndefined();
  });

  test("directions and paces", () => {
    expect(compassOf(359)).toBe("n");
    expect(compassOf(95)).toBe("e");
    expect(compassOf(225)).toBe("sw");
    expect(paceOf(0)).toBe("still");
    expect(paceOf(4)).toBe("running");
    expect(paceOf(12)).toBe("vehicle");
  });
});
