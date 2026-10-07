import { describe, expect, test } from "vitest";
import { dueRoutine, type Routine } from "./routines";

const weekdays = [1, 2, 3, 4, 5];
const commute: Routine = { id: "r1", label: "Office to home", days: weekdays, time: "21:00", kind: "walk" };
// Thursday 8 October 2026.
const at = (time: string, day = 8) => new Date(2026, 9, day, ...(time.split(":").map(Number) as [number, number]));

describe("regular journeys", () => {
  test("due from 10 minutes before to 30 minutes after, on its days", () => {
    expect(dueRoutine([commute], at("20:49"), {})).toBeNull();
    expect(dueRoutine([commute], at("20:50"), {})?.id).toBe("r1");
    expect(dueRoutine([commute], at("21:30"), {})?.id).toBe("r1");
    expect(dueRoutine([commute], at("21:31"), {})).toBeNull();
    expect(dueRoutine([commute], at("21:05", 11), {}), "Sunday").toBeNull();
  });

  test("a late-night routine is still due just after midnight", () => {
    const late: Routine = { ...commute, id: "r2", time: "23:50", days: [4] }; // Thursdays
    expect(dueRoutine([late], at("00:10", 9), {})?.id).toBe("r2");
  });

  test("the closest one wins, and 'not today' hides it until its next day", () => {
    const early: Routine = { ...commute, id: "r3", time: "20:45" };
    expect(dueRoutine([early, commute], at("21:00"), {})?.id).toBe("r1");
    expect(dueRoutine([commute], at("21:00"), { r1: "2026-10-8" })).toBeNull();
    expect(dueRoutine([commute], at("21:00", 9), { r1: "2026-10-8" })?.id).toBe("r1");
  });
});
