import { expect, test } from "vitest";
import { ANSWER_MS, CHECK_EVERY_MS, Companion } from "./companion";

test("asks every few minutes, and an answer starts the wait again", () => {
  const c = new Companion(0);
  expect(c.tick(CHECK_EVERY_MS - 1)).toBeNull();
  expect(c.tick(CHECK_EVERY_MS)).toBe("ask");
  expect(c.waiting).toBe(true);
  c.answered(CHECK_EVERY_MS + 5000);
  expect(c.waiting).toBe(false);
  expect(c.tick(2 * CHECK_EVERY_MS)).toBeNull();
  expect(c.tick(2 * CHECK_EVERY_MS + 5000)).toBe("ask");
});

test("no answer: asks again, then alerts, once", () => {
  const c = new Companion(0);
  c.tick(CHECK_EVERY_MS);
  expect(c.secondsLeft(CHECK_EVERY_MS + 10_000)).toBe(20);
  expect(c.tick(CHECK_EVERY_MS + ANSWER_MS)).toBe("askAgain");
  expect(c.tick(CHECK_EVERY_MS + 2 * ANSWER_MS)).toBe("alert");
  expect(c.tick(CHECK_EVERY_MS + 3 * ANSWER_MS)).toBeNull();
  c.answered(CHECK_EVERY_MS + 3 * ANSWER_MS);
  expect(c.tick(10 * CHECK_EVERY_MS)).toBeNull();
});

test("answering after the second ask still counts", () => {
  const c = new Companion(0);
  c.tick(CHECK_EVERY_MS);
  c.tick(CHECK_EVERY_MS + ANSWER_MS);
  c.answered(CHECK_EVERY_MS + ANSWER_MS + 1000);
  expect(c.tick(CHECK_EVERY_MS + 3 * ANSWER_MS)).toBeNull();
});
