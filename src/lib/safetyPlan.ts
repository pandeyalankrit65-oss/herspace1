// A personal safety plan for someone at risk at home: who to call, where to go, how to leave,
// what to keep ready. Kept only on this phone, never sent anywhere; erased on logout, when
// someone else signs in, or on request.
export const PLAN_KEY = "herspace_safety_plan";

export const ESSENTIALS = ["id", "childrenDocs", "ration", "bank", "cash", "medicines", "phone", "keys", "numbers", "evidence", "clothes"] as const;
export type Essential = (typeof ESSENTIALS)[number];

export type SafetyPlan = {
  signs: string;
  people: Array<{ name: string; phone: string }>;
  places: string;
  leaving: string;
  packed: Essential[];
  updatedAt?: string;
};

export const emptyPlan = (): SafetyPlan => ({ signs: "", people: [], places: "", leaving: "", packed: [] });

export function readPlan(): SafetyPlan {
  try {
    const raw = localStorage.getItem(PLAN_KEY);
    if (!raw) return emptyPlan();
    const p = JSON.parse(raw) as Partial<SafetyPlan>;
    return {
      signs: typeof p.signs === "string" ? p.signs : "",
      people: Array.isArray(p.people) ? p.people.filter((x) => x && typeof x.name === "string").slice(0, 10) : [],
      places: typeof p.places === "string" ? p.places : "",
      leaving: typeof p.leaving === "string" ? p.leaving : "",
      packed: Array.isArray(p.packed) ? p.packed.filter((e): e is Essential => (ESSENTIALS as readonly string[]).includes(e)) : [],
      updatedAt: p.updatedAt,
    };
  } catch {
    return emptyPlan();
  }
}

export function savePlan(plan: SafetyPlan, now = new Date()): SafetyPlan {
  const saved = { ...plan, updatedAt: now.toISOString() };
  try {
    localStorage.setItem(PLAN_KEY, JSON.stringify(saved));
  } catch {
    // Storage full or blocked: the plan lasts for this visit only.
  }
  return saved;
}

export function deletePlan() {
  try {
    localStorage.removeItem(PLAN_KEY);
  } catch {
    // ignore
  }
}

export const isEmpty = (p: SafetyPlan) => !p.signs.trim() && !p.places.trim() && !p.leaving.trim() && p.people.length === 0 && p.packed.length === 0;
