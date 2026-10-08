import { beforeEach, describe, expect, test } from "vitest";
import { answerFollowUp, clearFollowUps, dueFollowUp, morningAfter, readFollowUps, scheduleFollowUp, stopFollowUp } from "./followUp";

// Vitest runs in Node here: a small in-memory localStorage.
const store = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as Storage;

const sosAt = new Date(2026, 9, 8, 21, 30).getTime(); // Thursday 9:30 pm

describe("follow-up after an SOS or a report", () => {
  beforeEach(() => store.clear());

  test("asks at 10 am the next day, then 3 days after, then stops", () => {
    const f = scheduleFollowUp("sos", sosAt);
    expect(new Date(f.dueAt)).toEqual(new Date(2026, 9, 9, 10, 0));
    expect(dueFollowUp(new Date(2026, 9, 9, 9, 59).getTime())).toBeNull();
    const now = new Date(2026, 9, 9, 10, 5).getTime();
    expect(dueFollowUp(now)?.id).toBe(f.id);

    answerFollowUp(f.id, now);
    expect(dueFollowUp(now)).toBeNull();
    const second = readFollowUps()[0];
    expect(second.step).toBe(2);
    expect(new Date(second.dueAt)).toEqual(new Date(2026, 9, 11, 10, 0));

    answerFollowUp(f.id, second.dueAt);
    expect(readFollowUps()).toEqual([]);
  });

  test("seen late, the second check still comes a while after the first", () => {
    const f = scheduleFollowUp("report", sosAt);
    const late = new Date(2026, 9, 12, 9, 0).getTime(); // first opened 4 days on
    answerFollowUp(f.id, late);
    expect(readFollowUps()[0].dueAt).toBeGreaterThanOrEqual(late + 12 * 60 * 60 * 1000);
  });

  test("a second SOS replaces the first; a report is separate", () => {
    scheduleFollowUp("sos", sosAt);
    scheduleFollowUp("sos", sosAt + 1000);
    scheduleFollowUp("report", sosAt);
    expect(readFollowUps().map((f) => f.kind).sort()).toEqual(["report", "sos"]);
  });

  test("she can stop it, and logout clears it", () => {
    const f = scheduleFollowUp("sos", sosAt);
    stopFollowUp(f.id);
    expect(readFollowUps()).toEqual([]);
    scheduleFollowUp("report", sosAt);
    clearFollowUps();
    expect(readFollowUps()).toEqual([]);
  });

  test("10 am a given number of days after", () => {
    expect(new Date(morningAfter(sosAt, 3))).toEqual(new Date(2026, 9, 11, 10, 0));
  });
});
