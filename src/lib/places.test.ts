import { describe, expect, it } from "vitest";
import { isAt, metresBetween } from "./places";

const home = { lat: 28.6315, lng: 77.2167 };

describe("arrival at a saved place", () => {
  it("measures distances at city scale", () => {
    expect(Math.round(metresBetween(home, { lat: 28.6324, lng: 77.2167 }))).toBe(100); // 0.0009° of latitude
    expect(metresBetween({ lat: 28.6139, lng: 77.209 }, home)).toBeGreaterThan(2000);
  });

  it("counts as there within about a street's length", () => {
    expect(isAt({ lat: 28.6324, lng: 77.2167, accuracy: 20 }, home)).toBe(true);
    expect(isAt({ lat: 28.6335, lng: 77.2167, accuracy: 20 }, home)).toBe(false); // ~220 m away
  });

  it("ignores imprecise fixes, which could be anywhere nearby", () => {
    expect(isAt({ ...home, accuracy: 500 }, home)).toBe(false);
    expect(isAt({ ...home, accuracy: null }, home)).toBe(true);
  });
});
