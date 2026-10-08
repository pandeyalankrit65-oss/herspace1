import { metresBetween } from "@/lib/places";

type Fix = { lat: number; lng: number; accuracy?: number | null };
export type Motion = { speed: number; heading: number | null };

// Older than this, the previous position says little about how she's moving now.
const MAX_GAP_MS = 5 * 60 * 1000;
// Smaller moves than this (or than the GPS uncertainty) are noise, not movement.
const MIN_MOVE_M = 15;

// Speed (m/s) and direction (degrees from north) between two positions, worked out on her phone.
export function motionBetween(prev: { coords: Fix; at: number }, next: Fix, at: number): Motion | undefined {
  const seconds = (at - prev.at) / 1000;
  if (seconds <= 0 || seconds * 1000 > MAX_GAP_MS) return undefined;
  const moved = metresBetween(prev.coords, next);
  const noise = Math.max(MIN_MOVE_M, prev.coords.accuracy ?? 0, next.accuracy ?? 0);
  if (moved < noise) return { speed: 0, heading: null };
  const speed = Math.min(100, moved / seconds);
  return { speed: Math.round(speed * 10) / 10, heading: Math.round(bearing(prev.coords, next)) % 360 };
}

export function bearing(a: Fix, b: Fix) {
  const rad = Math.PI / 180;
  const y = Math.sin((b.lng - a.lng) * rad) * Math.cos(b.lat * rad);
  const x = Math.cos(a.lat * rad) * Math.sin(b.lat * rad) - Math.sin(a.lat * rad) * Math.cos(b.lat * rad) * Math.cos((b.lng - a.lng) * rad);
  return (Math.atan2(y, x) / rad + 360) % 360;
}

export type Pace = "still" | "walking" | "running" | "vehicle";
// Rough bands: walking is about 1.4 m/s, running 3 to 6, anything faster is most likely a vehicle.
export function paceOf(speed: number): Pace {
  if (speed < 0.4) return "still";
  if (speed < 2.5) return "walking";
  if (speed < 6.5) return "running";
  return "vehicle";
}

export const COMPASS = ["n", "ne", "e", "se", "s", "sw", "w", "nw"] as const;
export const compassOf = (heading: number) => COMPASS[Math.round(heading / 45) % 8];
