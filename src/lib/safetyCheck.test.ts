import { describe, expect, test } from "vitest";
import { ANSWER_MS, SafetyCheck, SuddenRun, isDark } from "./safetyCheck";

const MIN = 60_000;

describe("safety check", () => {
  test("one clue alone doesn't ask", () => {
    const check = new SafetyCheck();
    expect(check.add("running", 0)).toBe(false);
    expect(check.add("running", 10_000)).toBe(false);
    expect(new SafetyCheck().add("stress", 0)).toBe(false);
    expect(new SafetyCheck().add("risky_area_dark", 0)).toBe(false);
  });

  test("a scream is enough by itself", () => {
    expect(new SafetyCheck().add("scream", 0)).toBe(true);
  });

  test("running in an area with reports after dark asks", () => {
    const check = new SafetyCheck();
    check.add("risky_area_dark", 0);
    expect(check.add("running", MIN)).toBe(true);
    expect(check.reasons(MIN).sort()).toEqual(["risky_area_dark", "running"]);
  });

  test("running in an area with reports by day, or a long stop there, doesn't", () => {
    const check = new SafetyCheck();
    check.add("risky_area", 0);
    expect(check.add("long_stop", MIN)).toBe(false);
    expect(check.add("running", 2 * MIN)).toBe(true);
  });

  test("clues too far apart don't add up", () => {
    const check = new SafetyCheck();
    check.add("stress", 0);
    expect(check.add("running", 4 * MIN)).toBe(false);
  });

  test("after I'm okay, it stays quiet for a while and then counts afresh", () => {
    const check = new SafetyCheck();
    check.add("stress", 0);
    check.add("running", 1000);
    check.okay(ANSWER_MS);
    expect(check.add("scream", 2 * MIN)).toBe(false);
    expect(check.add("running", 11 * MIN)).toBe(false);
    expect(check.add("stress", 11 * MIN + 1000)).toBe(true);
  });
});

describe("sudden run", () => {
  test("walking then running twice in a row", () => {
    const run = new SuddenRun();
    expect(run.push("walking", 0)).toBe(false);
    expect(run.push("running", 20_000)).toBe(false);
    expect(run.push("running", 40_000)).toBe(true);
    expect(run.push("running", 60_000)).toBe(false); // said once
  });

  test("running for a bus and riding it isn't a sign", () => {
    const run = new SuddenRun();
    run.push("walking", 0);
    run.push("running", 20_000);
    run.push("vehicle", 40_000);
    expect(run.push("running", 60_000)).toBe(false);
    expect(run.push("running", 80_000)).toBe(false);
  });

  test("already running when it started (a jog) isn't sudden", () => {
    const run = new SuddenRun();
    expect(run.push("running", 0)).toBe(false);
    expect(run.push("running", 20_000)).toBe(false);
  });
});

test("dark is 6 pm to 6 am", () => {
  expect(isDark(new Date(2026, 9, 8, 22, 0))).toBe(true);
  expect(isDark(new Date(2026, 9, 8, 5, 59))).toBe(true);
  expect(isDark(new Date(2026, 9, 8, 12, 0))).toBe(false);
});
