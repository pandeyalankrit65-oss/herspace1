import { describe, expect, test } from "vitest";
import { cells, estimate, levelFor, pointWeight, withinPeriod, type RiskPoint } from "./risk";

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
});
