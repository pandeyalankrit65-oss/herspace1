// The Safe Map's heatmap and "reports near you" estimate. Built only from the public map points
// (already rounded to ~1 km), so it shows nothing the points don't. It describes reports, not
// safety: no reports never means an area is safe.

export type RiskPoint = {
  lat: number;
  lng: number;
  date: string;
  incidentType: string;
  trust?: "anonymous" | "account" | "verified";
  confirmations?: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
// A report counts half as much after 90 days, a quarter after 180.
export const HALF_LIFE_DAYS = 90;

const SEVERITY: Record<string, number> = { assault: 1.5, threat: 1.2, stalking: 1.2, harassment: 1, other: 0.8, discrimination: 0.6 };
const TRUST: Record<string, number> = { verified: 1.5, account: 1, anonymous: 0.6 };

export function pointWeight(p: RiskPoint, now = new Date()): number {
  const ageDays = Math.max(0, (now.getTime() - new Date(`${p.date.slice(0, 10)}T12:00:00`).getTime()) / DAY_MS);
  const recency = Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
  const confirmed = 1 + 0.5 * Math.min(p.confirmations ?? 0, 4);
  return (SEVERITY[p.incidentType] ?? 0.8) * (TRUST[p.trust ?? "account"] ?? 1) * confirmed * recency;
}

// Map points are rounded to 0.01°, so each distinct point is one ~1 km cell.
const CELL = 0.01;
const cellKey = (lat: number, lng: number) => `${Math.round(lat / CELL)}:${Math.round(lng / CELL)}`;

export type Cell = { lat: number; lng: number; score: number; count: number; level: Level };
export type Level = 0 | 1 | 2 | 3;

// Thresholds on the weighted sum: 1 fresh harassment report from an account scores 1.
export const levelFor = (score: number): Level => (score >= 6 ? 3 : score >= 2.5 ? 2 : score >= 0.75 ? 1 : 0);

export function cells(points: RiskPoint[], now = new Date()): Cell[] {
  const byCell = new Map<string, { lat: number; lng: number; score: number; count: number }>();
  for (const p of points) {
    const key = cellKey(p.lat, p.lng);
    const c = byCell.get(key) ?? { lat: Math.round(p.lat / CELL) * CELL, lng: Math.round(p.lng / CELL) * CELL, score: 0, count: 0 };
    c.score += pointWeight(p, now);
    c.count += 1;
    byCell.set(key, c);
  }
  return [...byCell.values()].map((c) => ({ ...c, level: levelFor(c.score) })).filter((c) => c.level > 0);
}

export function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export type Estimate = {
  level: Level;
  count: number;
  score: number;
  latest: string | null;
  topType: string | null;
  verified: number;
  // Fewer than this many reports can't say much either way.
  enoughData: boolean;
};

export const RADIUS_KM = 1.5;
const ENOUGH = 3;

export function estimate(points: RiskPoint[], at: { lat: number; lng: number }, now = new Date(), radiusKm = RADIUS_KM): Estimate {
  const near = points.filter((p) => km(at, p) <= radiusKm);
  const score = near.reduce((sum, p) => sum + pointWeight(p, now), 0);
  const types = new Map<string, number>();
  for (const p of near) types.set(p.incidentType, (types.get(p.incidentType) ?? 0) + 1);
  const topType = [...types.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const latest =
    near
      .map((p) => p.date.slice(0, 10))
      .sort()
      .at(-1) ?? null;
  return {
    level: levelFor(score),
    count: near.length,
    score,
    latest,
    topType,
    verified: near.filter((p) => p.trust === "verified" || (p.confirmations ?? 0) >= 2).length,
    enoughData: near.length >= ENOUGH,
  };
}

export const PERIODS = { "3m": 92, "12m": 366, all: Infinity } as const;
export type Period = keyof typeof PERIODS;

export const withinPeriod = (p: RiskPoint, period: Period, now = new Date()) =>
  (now.getTime() - new Date(`${p.date.slice(0, 10)}T12:00:00`).getTime()) / DAY_MS <= PERIODS[period];
