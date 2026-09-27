import { test, expect } from "@playwright/test";
import { addConfirmedContact, signUp } from "./helpers";

test.use({ permissions: ["geolocation"], geolocation: { latitude: 19.076, longitude: 72.8777 } });

test("with no connection, the SOS page still opens and offers to text contacts", async ({ page, browser, context }) => {
  await signUp(page, "Zoya");
  await addConfirmedContact(page, browser, "Sister");

  // One online visit lets the service worker cache the app and the contacts.
  await page.goto("/sos");
  await expect(page.getByText(/1 confirmed emergency contact\./)).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.waitForTimeout(1_000); // let the worker finish caching loaded assets

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText(/You're offline/)).toBeVisible();
  await page.getByRole("button", { name: /EMERGENCY SOS/ }).click();
  await expect(page.getByText("Your alert was NOT sent automatically")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("link", { name: "Text Sister" })).toHaveAttribute("href", /q%3D19\.076%2C72\.8777|q=19\.076,72\.8777/);
  await expect(page.getByRole("link", { name: "Call 112" }).first()).toHaveAttribute("href", "tel:112");
  await context.setOffline(false);
});
