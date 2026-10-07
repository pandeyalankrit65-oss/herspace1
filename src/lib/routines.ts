import { useEffect, useState } from "react";

// Regular journeys ("Office to home, weekdays at 9 pm"): a reminder to share the journey when
// it's due. They reveal when someone is usually alone, so they're kept only on this phone and
// removed on logout (see clearOfflineData).
export const ROUTINES_KEY = "herspace_routines";
const DISMISSED_KEY = "herspace_routines_dismissed";
const CHANGED = "herspace-routines-changed";
export const MAX_ROUTINES = 10;

export type Routine = {
  id: string;
  label: string;
  // 0 = Sunday ... 6 = Saturday, like Date.getDay().
  days: number[];
  time: string; // HH:MM, 24-hour
  kind: "walk" | "ride";
  placeId?: string; // a saved place to head to
};

// Due from 10 minutes before to 30 minutes after its time, on one of its days.
export const BEFORE_MIN = 10;
export const AFTER_MIN = 30;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked: routines just won't be remembered.
  }
}

const valid = (r: Routine) => typeof r?.id === "string" && Array.isArray(r.days) && /^([01]\d|2[0-3]):[0-5]\d$/.test(r.time ?? "");
export const readRoutines = () => read<Routine[]>(ROUTINES_KEY, []).filter(valid);

export function saveRoutines(routines: Routine[]) {
  write(ROUTINES_KEY, routines.slice(0, MAX_ROUTINES));
  window.dispatchEvent(new Event(CHANGED));
}

export function useRoutines() {
  const [routines, setRoutines] = useState(readRoutines);
  useEffect(() => {
    const sync = () => setRoutines(readRoutines());
    window.addEventListener(CHANGED, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGED, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return routines;
}

const localDay = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

// The routine due now, if any (closest to its time first), skipping ones dismissed today.
export function dueRoutine(routines: Routine[], now = new Date(), dismissed: Record<string, string> = readDismissed()): Routine | null {
  let best: { r: Routine; gap: number } | null = null;
  for (const r of routines) {
    const [h, m] = r.time.split(":").map(Number);
    // Its time today, yesterday and tomorrow, so 23:50 is due at 00:10 the next day.
    for (const shift of [-1, 0, 1]) {
      const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + shift, h, m);
      const gap = (now.getTime() - at.getTime()) / 60_000;
      if (gap < -BEFORE_MIN || gap > AFTER_MIN || !r.days.includes(at.getDay())) continue;
      if (dismissed[r.id] === localDay(at)) continue;
      if (!best || Math.abs(gap) < Math.abs(best.gap)) best = { r, gap };
    }
  }
  return best?.r ?? null;
}

const readDismissed = () => read<Record<string, string>>(DISMISSED_KEY, {});

// "Not today": hides the reminder until the routine's next day.
export function dismissForToday(id: string, now = new Date()) {
  write(DISMISSED_KEY, { ...readDismissed(), [id]: localDay(now) });
  window.dispatchEvent(new Event(CHANGED));
}

export const clearRoutines = () => {
  try {
    localStorage.removeItem(ROUTINES_KEY);
    localStorage.removeItem(DISMISSED_KEY);
  } catch {
    // ignore
  }
};

// Re-checks every half minute, so a reminder appears while the page is open.
export function useDueRoutine() {
  const routines = useRoutines();
  const [due, setDue] = useState<Routine | null>(() => dueRoutine(routines));
  useEffect(() => {
    const check = () => setDue(dueRoutine(readRoutines()));
    check();
    const id = window.setInterval(check, 30_000);
    window.addEventListener(CHANGED, check);
    return () => {
      window.clearInterval(id);
      window.removeEventListener(CHANGED, check);
    };
  }, [routines]);
  return due;
}
