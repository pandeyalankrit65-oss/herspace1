import { beforeEach, expect, test } from "vitest";
import { forLockScreen, rescheduleFor } from "./lockScreen";

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

const text = { title: "HerSpace", body: "Just checking in. How are you doing today?" };

beforeEach(() => store.clear());

test("notifications say what they're about normally", () => {
  expect(forLockScreen(text)).toEqual(text);
});

test("in disguised mode they say only \"Reminder\"", () => {
  store.set("herspace_disguise", JSON.stringify({ enabled: true, pinHash: "abc" }));
  store.set("herspace_lang", "en");
  expect(forLockScreen(text)).toEqual({ title: "Reminder", body: "You have a reminder." });
});

test("Android's pending times are turned back into dates; past and unreadable ones are left alone", () => {
  const now = new Date("2026-10-10T02:00:00+05:30").getTime();
  const future = rescheduleFor({ at: "Sun Oct 11 10:00:00 GMT+05:30 2026" }, now);
  expect((future?.at as Date).toISOString()).toBe("2026-10-11T04:30:00.000Z");
  expect(rescheduleFor({ at: "Sat Oct 10 01:00:00 GMT+05:30 2026" }, now)).toBeNull();
  expect(rescheduleFor({ at: "not a date" }, now)).toBeNull();
  expect(rescheduleFor({ on: { weekday: 3, hour: 8, minute: 15 } }, now)).toEqual({ on: { weekday: 3, hour: 8, minute: 15 }, allowWhileIdle: true });
  expect(rescheduleFor(undefined, now)).toBeNull();
});
