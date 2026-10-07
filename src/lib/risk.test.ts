import { describe, expect, test } from "vitest";
import { alongTheWay, cells, estimate, levelFor, pointWeight, timeOfDay, warningAt, withinPeriod, type RiskPoint } from "./risk";

const now = new Date("2026-10-08T12:00:00");
const p = (extra: Partial<RiskPoint> = {}): RiskPoint => ({
  lat: 18.52,
  lng: 73.85,
  date: "2026-10-08",
  incidentType: "harassment",
  trust: "account",
  ...extra,
});

describe("risk estimate", () => {
  test("weights: severity, who reported it, confirmations, and age", () => {
    expect(pointWeight(p(), now)).toBeCloseTo(1);
    expect(pointWeight(p({ incidentType: "assault" }), now)).toBeCloseTo(1.5);
    expect(pointWeight(p({ trust: "verified" }), now)).toBeCloseTo(1.5);
    expect(pointWeight(p({ trust: "anonymous" }), now)).toBeCloseTo(0.6);
    expect(pointWeight(p({ confirmations: 2 }), now)).toBeCloseTo(2);
    expect(pointWeight(p({ confirmations: 50 }), now), "confirmations are capped").toBeCloseTo(3);
    expect(pointWeight(p({ date: "2026-07-10" }), now), "halved after 90 days").toBeCloseTo(0.5, 1);
  });

  test("groups points into ~1 km cells and drops the faintest", () => {
    const grid = cells([p(), p(), p({ lat: 18.53 }), p({ lat: 19, date: "2024-01-01" })], now);
    expect(grid).toHaveLength(2);
    const busiest = grid.find((c) => c.count === 2)!;
    expect(busiest.score).toBeCloseTo(2);
    expect(busiest.level).toBe(1);
  });

  test("levels", () => {
    expect([0.5, 1, 3, 7].map(levelFor)).toEqual([0, 1, 2, 3]);
  });

  test("near you: counts reports within 1.5 km, and says when there is too little to tell", () => {
    const here = { lat: 18.52, lng: 73.85 };
    const few = estimate([p(), p({ lat: 18.6 })], here, now);
    expect(few).toMatchObject({ count: 1, enoughData: false });
    const many = estimate(
      [p(), p({ incidentType: "stalking" }), p({ incidentType: "stalking", trust: "verified", date: "2026-09-01" }), p({ lat: 18.6 })],
      here,
      now,
    );
    expect(many).toMatchObject({ count: 3, enoughData: true, topType: "stalking", latest: "2026-10-08", verified: 1 });
    expect(many.level).toBe(2);
  });

  test("period filter", () => {
    expect(withinPeriod(p({ date: "2026-08-01" }), "3m", now)).toBe(true);
    expect(withinPeriod(p({ date: "2026-05-01" }), "3m", now)).toBe(false);
    expect(withinPeriod(p({ date: "2020-01-01" }), "all", now)).toBe(true);
  });

  test("time of day: mostly after dark, in the day, or mixed, from at least 3 timed reports", () => {
    expect(timeOfDay([p({ hour: 22 }), p({ hour: 23 })])).toBeNull();
    expect(timeOfDay([p({ hour: 22 }), p({ hour: 2 }), p({ hour: 19 }), p({ hour: null })])).toBe("night");
    expect(timeOfDay([p({ hour: 9 }), p({ hour: 13 }), p({ hour: 16 })])).toBe("day");
    expect(timeOfDay([p({ hour: 9 }), p({ hour: 21 }), p({ hour: 16 }), p({ hour: 23 })])).toBe("mixed");
  });

  test("journey warnings: only near a square with several reports, with what is known about it", () => {
    const busy = [p({ hour: 21 }), p({ hour: 22, incidentType: "stalking" }), p({ hour: 23, incidentType: "stalking" })];
    expect(warningAt([p()], { lat: 18.52, lng: 73.85 }, now), "one report is not a warning").toBeNull();
    const w = warningAt(busy, { lat: 18.523, lng: 73.851 }, now)!;
    expect(w).toMatchObject({ key: "18.52:73.85", level: 2, count: 3, topType: "stalking", timeOfDay: "night" });
    expect(warningAt(busy, { lat: 18.56, lng: 73.85 }, now), "4 km away").toBeNull();
  });

  test("along the way: squares near the straight line, in order from the start", () => {
    const from = { lat: 18.5, lng: 73.8 };
    const to = { lat: 18.6, lng: 73.8 }; // 11 km north
    const pts = [p({ lat: 18.58, lng: 73.8 }), p({ lat: 18.52, lng: 73.8 }), p({ lat: 18.55, lng: 73.86 }), p({ lat: 18.7, lng: 73.8 })];
    const way = alongTheWay(pts, from, to, now);
    expect(way.map((c) => c.lat.toFixed(2))).toEqual(["18.52", "18.58"]);
    expect(way[0].at).toBeCloseTo(0.2, 1);
  });
});
