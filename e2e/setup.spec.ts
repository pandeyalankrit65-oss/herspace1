import { test, expect } from "@playwright/test";
import { addConfirmedContact, signUp } from "./helpers";

test.use({ permissions: ["geolocation"], geolocation: { latitude: 19.076, longitude: 72.8777 } });

test("the setup checklist walks a new user to a working test alert, then disappears", async ({ page, browser }) => {
  await signUp(page, "Meera");
  await page.goto("/");
  const checklist = page.getByRole("heading", { name: "Get ready for an emergency" });
  await expect(checklist).toBeVisible();
  await expect(page.getByText("1 of 4 done")).toBeVisible(); // location is already allowed

  await page.getByRole("button", { name: "Do this" }).click();
  await expect(page).toHaveURL(/\/contacts$/);
  await addConfirmedContact(page, browser, "Mom");

  await page.goto("/sos");
  await expect(page.getByText("3 of 4 done")).toBeVisible();
  await page.getByRole("button", { name: "Do this" }).click();
  await page.getByRole("button", { name: "Send test alert" }).click();
  await expect(page.getByText("Test alert sent", { exact: true })).toBeVisible();

  // Wait for the checklist's data, so "hidden" means complete rather than still loading.
  const loaded = page.waitForResponse((r) => r.url().endsWith("/api/account/setup") && r.ok());
  await page.goto("/");
  expect(await (await loaded).json()).toMatchObject({ confirmed: 1, testSent: true });
  await expect(checklist).toBeHidden();
});
