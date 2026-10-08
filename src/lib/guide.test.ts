import { describe, expect, test } from "vitest";
import { guidance, pickSafePlace, roundMetres, type SafePlace } from "./guide";

const here = { lat: 25.3, lng: 82.97 };
const place = (id: string, type: SafePlace["type"], dLat: number, dLng: number, openingHours: string | null = null): SafePlace => ({
  id,
  type,
  name: id,
  lat: here.lat + dLat,
  lng: here.lng + dLng,
  openingHours,
});

describe("picking a safe place", () => {
  const pharmacy = place("pharmacy", "pharmacy", 0.003, 0);
  const police = place("police", "police", 0, 0.005);

  test("the nearest by day", () => {
    expect(pickSafePlace([police, pharmacy], here, new Date(2026, 9, 8, 12))?.id).toBe("pharmacy");
  });

  test("after dark a pharmacy that may be shut counts as further", () => {
    expect(pickSafePlace([police, pharmacy], here, new Date(2026, 9, 8, 22))?.id).toBe("police");
    const allNight = place("allnight", "pharmacy", 0.003, 0, "24/7");
    expect(pickSafePlace([police, allNight], here, new Date(2026, 9, 8, 22))?.id).toBe("allnight");
  });

  test("nothing nearby", () => {
    expect(pickSafePlace([], here)).toBeNull();
  });
});

describe("guidance", () => {
  const north = { lat: here.lat + 0.002, lng: here.lng };

  test("without a heading, a compass direction", () => {
    const g = guidance(here, null, north);
    expect(g.side).toBeNull();
    expect(g.compass).toBe("n");
    expect(g.metres).toBeGreaterThan(200);
    expect(g.arrived).toBe(false);
  });

  test("relative to where she's walking", () => {
    expect(guidance(here, 0, north).side).toBe("ahead");
    expect(guidance(here, 90, north).side).toBe("left");
    expect(guidance(here, 270, north).side).toBe("right");
    expect(guidance(here, 180, north).side).toBe("behind");
  });

  test("arrived within 30 m", () => {
    expect(guidance(here, null, { lat: here.lat + 0.0002, lng: here.lng }).arrived).toBe(true);
  });

  test("distances rounded to be easy to hear", () => {
    expect(roundMetres(4)).toBe(10);
    expect(roundMetres(143)).toBe(140);
    expect(roundMetres(437)).toBe(450);
  });
});
