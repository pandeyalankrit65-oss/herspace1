import { beforeEach, expect, test } from "vitest";
import { forLockScreen } from "./lockScreen";

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
