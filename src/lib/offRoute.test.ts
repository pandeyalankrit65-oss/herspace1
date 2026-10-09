import { expect, test } from "vitest";
import { OffRoute } from "./offRoute";

const S = 1000;

test("getting closer is fine, and a short wobble isn't a wrong turn", () => {
  const r = new OffRoute();
  for (const [m, t] of [[5000, 0], [4200, 30], [3500, 60], [3700, 90], [3300, 120]]) expect(r.push(m, t * S)).toBe(false);
});

test("heading clearly away for a while says so, once", () => {
  const r = new OffRoute();
  r.push(5000, 0);
  r.push(3000, 60 * S);
  expect(r.push(3800, 90 * S)).toBe(false); // 800 m further: first sign
  expect(r.push(4300, 120 * S)).toBe(false); // second
  expect(r.push(4900, 150 * S)).toBe(false); // third, but only 60 s
  expect(r.push(5400, 180 * S)).toBe(true); // 90 s on
  expect(r.push(6000, 210 * S)).toBe(false); // said already
});

test("one GPS jump, then back on track, doesn't count", () => {
  const r = new OffRoute();
  r.push(3000, 0);
  r.push(4000, 30 * S);
  r.push(2900, 60 * S);
  r.push(3900, 90 * S);
  r.push(4000, 120 * S);
  expect(r.push(2800, 200 * S)).toBe(false);
});

test("near the end, a fifth of the way is the margin: 400 m at least", () => {
  const r = new OffRoute();
  r.push(800, 0);
  for (const t of [30, 60, 100]) expect(r.push(1100, t * S)).toBe(false); // 300 m: under 400 m
});

test("after \"it's a detour\" it starts again from there", () => {
  const r = new OffRoute();
  r.push(3000, 0);
  for (const t of [30, 60, 120]) r.push(4000, t * S);
  r.detour();
  for (const [m, t] of [[4100, 150], [4200, 180], [4300, 260]]) expect(r.push(m, t * S)).toBe(false);
});
