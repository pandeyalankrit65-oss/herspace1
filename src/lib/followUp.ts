// Gentle follow-up after an SOS or a report: "How are you doing?" the next day at 10 am and
// again three days after. Kept only on this phone (it would reveal what happened), and removed
// on logout like the mood journal.

export const FOLLOW_UPS_KEY = "herspace_follow_ups";

export type FollowUpKind = "sos" | "report";
export type FollowUp = { id: string; kind: FollowUpKind; eventAt: number; dueAt: number; step: 1 | 2 };
export type Feeling = "better" | "same" | "worse";

const DAY_MS = 24 * 60 * 60 * 1000;

// 10 am, `days` after the day of `from`, in local time.
export function morningAfter(from: number, days: number) {
  const d = new Date(from);
  d.setHours(10, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

export function readFollowUps(): FollowUp[] {
  try {
    const list = JSON.parse(localStorage.getItem(FOLLOW_UPS_KEY) ?? "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function save(list: FollowUp[]) {
  try {
    if (list.length) localStorage.setItem(FOLLOW_UPS_KEY, JSON.stringify(list));
    else localStorage.removeItem(FOLLOW_UPS_KEY);
  } catch {
    // private mode: no follow-up this time
  }
}

// One follow-up at a time per kind: a second SOS the same week replaces the first.
export function scheduleFollowUp(kind: FollowUpKind, at = Date.now()): FollowUp {
  const f: FollowUp = { id: `${kind}-${at}`, kind, eventAt: at, dueAt: morningAfter(at, 1), step: 1 };
  save([...readFollowUps().filter((x) => x.kind !== kind), f]);
  return f;
}

// The follow-up to show now, if any: the oldest that's due.
export function dueFollowUp(now = Date.now()): FollowUp | null {
  return readFollowUps()
    .filter((f) => f.dueAt <= now)
    .sort((a, b) => a.dueAt - b.dueAt)[0] ?? null;
}

// After she answers: the second check comes 3 days after the event, unless it was the last.
export function answerFollowUp(id: string, now = Date.now()) {
  const list = readFollowUps();
  const f = list.find((x) => x.id === id);
  if (!f) return;
  const rest = list.filter((x) => x.id !== id);
  save(f.step === 1 ? [...rest, { ...f, step: 2, dueAt: Math.max(morningAfter(f.eventAt, 3), now + DAY_MS / 2) }] : rest);
}

export function stopFollowUp(id: string) {
  save(readFollowUps().filter((x) => x.id !== id));
}

export function clearFollowUps() {
  save([]);
}
