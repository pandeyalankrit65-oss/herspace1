import { test, expect } from "@playwright/test";
import { addConfirmedContact, signUp } from "./helpers";

// Patna: no other test uses these coordinates. Home is the destination; the ride starts 3 km south.
const HOME = { latitude: 25.61, longitude: 85.14, accuracy: 10 };
const south = (km: number) => ({ ...HOME, latitude: HOME.latitude - km / 111 });

test("a ride that keeps heading away from home is noticed, and \"it's a detour\" quietens it", async ({ page, browser, context }) => {
  test.setTimeout(120_000);
  await context.grantPermissions(["geolocation"]);
  await page.clock.install();
  await signUp(page, "Pooja");
  await addConfirmedContact(page, browser, "Didi");

  await context.setGeolocation(HOME);
  await page.goto("/account");
  await page.getByRole("button", { name: "Add a place" }).click();
  await page.getByRole("button", { name: "Save place" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Home" })).toBeVisible();

  await context.setGeolocation(south(3));
  await page.goto("/walk");
  await page.getByRole("tab", { name: "Cab or auto" }).click();
  await page.getByLabel("Vehicle number").fill("BR 01 PA 4321");
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await page.getByRole("button", { name: "Start sharing" }).click();
  await expect(page.getByText("Heading to Home.")).toBeVisible();

  const warning = page.getByRole("alert").filter({ hasText: "Your ride seems to be heading away from Home" });
  // Closer first, then clearly away, over a couple of minutes.
  for (const km of [2.2, 3.3, 3.6, 3.9, 4.2]) {
    await page.clock.fastForward("00:35");
    await context.setGeolocation(south(km));
    if (km < 4.2) await expect(warning).toHaveCount(0);
  }
  await expect(warning).toBeVisible();

  // A detour she agreed to: it goes away and starts watching again from here.
  await warning.getByRole("button", { name: "It's a detour, I'm fine" }).click();
  await expect(warning).toHaveCount(0);
  await page.clock.fastForward("00:35");
  await context.setGeolocation(south(3.7));
  await expect(warning).toHaveCount(0);
});
