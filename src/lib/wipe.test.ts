import { beforeEach, expect, test } from "vitest";
import { wipeLocalData } from "./wipe";

// Vitest runs in Node here: small in-memory stores.
const store = new Map<string, string>();
const storage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() {
    return store.size;
  },
} as Storage;
globalThis.localStorage = new Proxy(storage, { ownKeys: () => [...store.keys()], getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }) });
globalThis.sessionStorage = { clear: () => {} } as Storage;

beforeEach(() => store.clear());

test("removes everything HerSpace keeps on the phone, but stays a calculator", () => {
  for (const key of ["herspace_mood_journal", "herspace_safety_plan", "herspace_places", "herspace_follow_ups", "herspace_user", "herspace_unlocked", "herspace_saved_map"])
    store.set(key, "x");
  for (const key of ["herspace_disguise", "herspace_lang", "herspace_theme", "herspace_quick_exit", "someone_elses"]) store.set(key, "keep");
  wipeLocalData();
  expect([...store.keys()].sort()).toEqual(["herspace_disguise", "herspace_lang", "herspace_quick_exit", "herspace_theme", "someone_elses"]);
});
