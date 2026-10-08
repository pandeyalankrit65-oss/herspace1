import { test, expect } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import { addConfirmedContact, failOnConsoleErrors, readOutbox, signUp, waitForMessage } from "./helpers";

// Around Chandigarh: a different square for each test and project; no other test uses these.
const spot = (project: string, n: number) => ({ lat: project === "phone" ? 30.8 : 30.7, lng: 76.78 + n * 0.05 });

async function threeReports(request: APIRequestContext, at: { lat: number; lng: number }, tag: string) {
  for (const i of [1, 2, 3]) {
    const res = await request.post("/api/reports", {
      headers: { "X-Requested-With": "HerSpace" },
      data: { incidentType: "assault", description: `Grabbed near the bus stand, report ${i} (${tag})`, coords: at, anonymous: true },
    });
    expect(res.ok()).toBe(true);
  }
}

test("running in an area with several reports asks \"Are you okay?\", and no answer sends a silent SOS", async ({ page, browser, context }, testInfo) => {
  test.setTimeout(150_000);
  const assertNoErrors = failOnConsoleErrors(page);
  const at = spot(testInfo.project.name, 0);
  await threeReports(page.request, at, `no answer, ${testInfo.project.name}`);

  await signUp(page, "Meera");
  const sister = await addConfirmedContact(page, browser, "Sister");
  await context.grantPermissions(["geolocation"]);
  // Inside the square already, standing at a bus stop.
  const start = { latitude: at.lat - 0.003, longitude: at.lng, accuracy: 5 };
  await context.setGeolocation(start);

  await page.goto("/walk");
  await page.getByRole("switch", { name: "Ask if I'm okay when something seems wrong" }).click();
  await page.getByRole("button", { name: "1 hr", exact: true }).click();
  await page.getByRole("button", { name: "Start sharing" }).click();
  await expect(page.getByText("Sharing your journey", { exact: true })).toBeVisible();

  // An area with reports alone doesn't ask (it only warns); nor does walking.
  await page.waitForTimeout(11_000);
  await context.setGeolocation({ ...start, latitude: start.latitude + 0.00004 });
  await expect(page.getByText(/recent reports around here/)).toBeVisible();
  await page.waitForTimeout(11_000);
  await expect(page.getByRole("alertdialog")).toHaveCount(0);

  // Then running: about 50 m every 11 seconds, twice.
  await context.setGeolocation({ ...start, latitude: start.latitude + 0.0005 });
  await page.waitForTimeout(11_000);
  await context.setGeolocation({ ...start, latitude: start.latitude + 0.001 });
  const check = page.getByRole("alertdialog", { name: "Are you okay?" });
  await expect(check).toBeVisible();
  // "after dark" too when the test runs in the evening.
  await expect(check).toContainText("running all of a sudden");
  await expect(check).toContainText("an area with several reports");
  await expect(check).toContainText(/silent SOS goes to your contacts in \d+ seconds/);

  // No answer: a silent SOS, and contacts are told how it started.
  const sos = await waitForMessage((m) => m.to === sister.phone && m.body.startsWith("HerSpace SOS"), 45_000);
  expect(sos.body).toContain("didn't answer a safety check");
  expect(sos.body).toContain("DON'T call them first");
  await expect(page).toHaveURL(/\/sos$/);
  await expect(page.getByText("Sharing your live location")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "I'm safe, stop sharing" }).click();
  assertNoErrors();
});

test("\"I'm okay\" closes the check and sends nothing", async ({ page, browser, context }, testInfo) => {
  test.setTimeout(120_000);
  const at = spot(testInfo.project.name, 1);
  await threeReports(page.request, at, `okay, ${testInfo.project.name}`);
  await signUp(page, "Leela");
  const friend = await addConfirmedContact(page, browser, "Friend");
  await context.grantPermissions(["geolocation"]);
  const start = { latitude: at.lat - 0.003, longitude: at.lng, accuracy: 5 };
  await context.setGeolocation(start);

  await page.goto("/walk");
  await page.getByRole("switch", { name: "Ask if I'm okay when something seems wrong" }).click();
  await page.getByRole("button", { name: "1 hr", exact: true }).click();
  await page.getByRole("button", { name: "Start sharing" }).click();
  await expect(page.getByText("Sharing your journey", { exact: true })).toBeVisible();
  await page.waitForTimeout(11_000);
  await context.setGeolocation({ ...start, latitude: start.latitude + 0.00004 });
  await page.waitForTimeout(11_000);
  await context.setGeolocation({ ...start, latitude: start.latitude + 0.0005 });
  await page.waitForTimeout(11_000);
  await context.setGeolocation({ ...start, latitude: start.latitude + 0.001 });

  const check = page.getByRole("alertdialog", { name: "Are you okay?" });
  await check.getByRole("button", { name: "I'm okay" }).click();
  await expect(check).toHaveCount(0);
  await page.waitForTimeout(32_000);
  await expect(page).toHaveURL(/\/walk$/);
  expect(readOutbox().some((m) => m.to === friend.phone && m.body.startsWith("HerSpace SOS"))).toBe(false);
});
