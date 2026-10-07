import { test, expect } from "@playwright/test";
import { addConfirmedContact, signUp } from "./helpers";

// Different places for desktop and phone, used by no other test.
const spot = (project: string) => ({ lat: project === "phone" ? 22.62 : 22.57, lng: 88.36 });

test("walking into an area with several recent reports shows a warning, once, with what happened there", async ({ page, browser, context }, testInfo) => {
  const at = spot(testInfo.project.name);
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: at.lat + 0.02, longitude: at.lng, accuracy: 20 });

  // Three recent assaults reported here after dark.
  for (const [i, time] of ["21:15", "22:40", "23:05"].entries()) {
    const res = await page.request.post("/api/reports", {
      headers: { "X-Requested-With": "HerSpace" },
      data: { incidentType: "assault", description: `Grabbed near the underpass, report ${i} (${testInfo.project.name})`, coords: at, time, anonymous: true },
    });
    expect(res.ok()).toBe(true);
  }

  await signUp(page, "Asha");
  await addConfirmedContact(page, browser, "Riya");
  await page.goto("/walk");
  await page.getByRole("button", { name: "1 hr", exact: true }).click();
  await page.getByRole("button", { name: "Start sharing" }).click();
  await expect(page.getByText("Sharing your journey", { exact: true })).toBeVisible();
  // About 2 km away: no warning yet.
  await page.waitForTimeout(1500);
  await expect(page.getByText(/recent reports around here/)).toHaveCount(0);

  // Walking into the square.
  await context.setGeolocation({ latitude: at.lat, longitude: at.lng, accuracy: 20 });
  const warning = page.getByRole("alert").filter({ hasText: "recent reports around here" });
  await expect(warning).toContainText("3 recent reports around here");
  await expect(warning).toContainText("Mostly Assault.");
  await expect(warning).toContainText("Mostly after dark.");
  await expect(warning.getByRole("link", { name: "Fake call" })).toHaveAttribute("href", "/sos#fake-call");

  // Dismissed, it doesn't come back for the same square.
  await warning.getByRole("button", { name: "Hide this warning" }).click();
  await context.setGeolocation({ latitude: at.lat + 0.001, longitude: at.lng, accuracy: 20 });
  await page.waitForTimeout(1500);
  await expect(page.getByText(/recent reports around here/)).toHaveCount(0);
  await page.getByRole("button", { name: "I've arrived, stop sharing" }).click();
});
