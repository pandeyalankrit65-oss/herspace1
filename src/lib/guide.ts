import { metresBetween } from "@/lib/places";
import { bearing, compassOf } from "@/lib/motion";
import { isDark } from "@/lib/safetyCheck";

type Point = { lat: number; lng: number };
export type SafePlace = Point & { id: string; type: "police" | "hospital" | "pharmacy"; name: string | null; openingHours: string | null };

// Somewhere with people: police and hospitals are open all night; a pharmacy that doesn't say
// it's open 24/7 counts as twice as far after dark, since it may be shut.
export function pickSafePlace<P extends SafePlace>(places: P[], here: Point, now = new Date()): P | null {
  let best: { place: P; cost: number } | null = null;
  for (const place of places) {
    const shutRisk = place.type === "pharmacy" && isDark(now) && place.openingHours !== "24/7" ? 2 : 1;
    const cost = metresBetween(here, place) * shutRisk;
    if (!best || cost < best.cost) best = { place, cost };
  }
  return best?.place ?? null;
}

export type Side = "ahead" | "right" | "behind" | "left";
export type Guidance = { metres: number; side: Side | null; compass: ReturnType<typeof compassOf>; arrived: boolean };

export const ARRIVED_M = 30;

// How far and which way. With her heading (she's moving), relative to where she's going:
// ahead, right, behind or left. Without it, a compass direction.
export function guidance(here: Point, heading: number | null, place: Point): Guidance {
  const metres = metresBetween(here, place);
  const toPlace = bearing(here, place);
  let side: Side | null = null;
  if (heading !== null) {
    const turn = (toPlace - heading + 360) % 360;
    side = turn < 45 || turn >= 315 ? "ahead" : turn < 135 ? "right" : turn < 225 ? "behind" : "left";
  }
  return { metres, side, compass: compassOf(toPlace), arrived: metres <= ARRIVED_M };
}

// Easier to hear: to the nearest 10 m close by, 50 m further away.
export const roundMetres = (m: number) => (m < 200 ? Math.max(10, Math.round(m / 10) * 10) : Math.round(m / 50) * 50);
