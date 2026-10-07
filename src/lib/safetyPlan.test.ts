import { beforeEach, describe, expect, test } from "vitest";
import { deletePlan, emptyPlan, isEmpty, PLAN_KEY, readPlan, savePlan } from "./safetyPlan";

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

describe("safety plan", () => {
  beforeEach(() => store.clear());

  test("saved on the device and read back; deleting leaves an empty plan", () => {
    expect(isEmpty(readPlan())).toBe(true);
    savePlan({ ...emptyPlan(), signs: "He starts drinking", people: [{ name: "Didi", phone: "+91 98100 00000" }], packed: ["id", "cash"] });
    const plan = readPlan();
    expect(plan.people[0].name).toBe("Didi");
    expect(plan.packed).toEqual(["id", "cash"]);
    expect(plan.updatedAt).toBeTruthy();
    deletePlan();
    expect(isEmpty(readPlan())).toBe(true);
  });

  test("damaged or unexpected data is ignored, not trusted", () => {
    store.set(PLAN_KEY, "{oops");
    expect(isEmpty(readPlan())).toBe(true);
    store.set(PLAN_KEY, JSON.stringify({ signs: 5, packed: ["id", "jewellery"], people: [null, { name: "Ma", phone: "1" }] }));
    const plan = readPlan();
    expect(plan.signs).toBe("");
    expect(plan.packed).toEqual(["id"]);
    expect(plan.people).toEqual([{ name: "Ma", phone: "1" }]);
  });
});
