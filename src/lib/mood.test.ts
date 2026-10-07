import { beforeEach, describe, expect, test } from "vitest";
import { MOOD_KEY, deleteJournal, localDay, needsSupport, readJournal, saveMood, type MoodEntry } from "./mood";

// Unit tests run in Node, which has no localStorage: a small in-memory stand-in.
const store = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() {
    return store.size;
  },
} as Storage;

const day = (s: string) => new Date(`${s}T10:00:00`);

describe("mood journal", () => {
  beforeEach(() => localStorage.clear());

  test("one check-in per day, newest first, kept only on the device", () => {
    saveMood(3, "", day("2026-10-01"));
    saveMood(2, "rough day", day("2026-10-02"));
    const entries = saveMood(4, "  better after a walk  ", day("2026-10-02"));
    expect(entries.map((e) => [e.date, e.mood, e.note])).toEqual([
      ["2026-10-02", 4, "better after a walk"],
      ["2026-10-01", 3, undefined],
    ]);
    expect(readJournal()).toEqual(entries);
    deleteJournal();
    expect(readJournal()).toEqual([]);
  });

  test("ignores damaged data", () => {
    localStorage.setItem(MOOD_KEY, "{not json");
    expect(readJournal()).toEqual([]);
    localStorage.setItem(
      MOOD_KEY,
      JSON.stringify([
        { date: "2026-10-01", mood: 9 },
        { date: "2026-10-02", mood: 2, at: "" },
      ]),
    );
    expect(readJournal()).toHaveLength(1);
  });

  test("keeps the last 60 days", () => {
    for (let i = 0; i < 70; i++) saveMood(3, "", new Date(2026, 0, 1 + i, 10));
    const entries = readJournal();
    expect(entries).toHaveLength(60);
    expect(entries[0].date).toBe(localDay(new Date(2026, 0, 70)));
  });

  test("offers support after the lowest mood today, or three low check-ins in a week", () => {
    const e = (date: string, mood: MoodEntry["mood"]): MoodEntry => ({ date, mood, at: "" });
    const now = day("2026-10-08");
    expect(needsSupport([], now)).toBe(false);
    expect(needsSupport([e("2026-10-08", 1)], now)).toBe(true);
    expect(needsSupport([e("2026-10-07", 1)], now), "yesterday's alone is not enough").toBe(false);
    expect(needsSupport([e("2026-10-08", 2), e("2026-10-06", 2), e("2026-10-04", 1)], now)).toBe(true);
    expect(needsSupport([e("2026-10-08", 2), e("2026-10-06", 3), e("2026-10-04", 1)], now)).toBe(false);
    expect(needsSupport([e("2026-10-08", 2), e("2026-10-06", 2), e("2026-09-20", 1)], now), "not within a week").toBe(false);
  });
});
