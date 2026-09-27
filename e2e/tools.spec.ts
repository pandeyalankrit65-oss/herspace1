import { test, expect } from "@playwright/test";
import { signUp } from "./helpers";

test("fake call rings, can be answered and ended", async ({ page }) => {
  await page.goto("/sos");
  await page.getByLabel("Caller name").fill("Didi");
  await page.getByRole("button", { name: "Now", exact: true }).click();
  await page.getByRole("button", { name: "Schedule call" }).click();

  const call = page.getByRole("dialog", { name: "Incoming call" });
  await expect(call).toBeVisible();
  await expect(call.getByText("Didi")).toBeVisible();
  await call.getByRole("button", { name: "Accept" }).click();
  await expect(call.getByText(/^00:0\d$/)).toBeVisible();
  await call.getByRole("button", { name: "End call" }).click();
  await expect(call).toBeHidden();
});

test("a delayed fake call can be cancelled", async ({ page }) => {
  await page.goto("/sos");
  await page.getByRole("button", { name: "10 sec" }).click();
  await page.getByRole("button", { name: "Schedule call" }).click();
  await expect(page.getByText(/Your phone will ring in \d+ seconds/)).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.waitForTimeout(11_000);
  await expect(page.getByRole("dialog", { name: "Incoming call" })).toHaveCount(0);
});

test("login ?next= can't redirect to another site", async ({ page }) => {
  const { email } = await signUp(page, "Lina");
  await page.context().clearCookies();
  // "/\evil.example": browsers treat the backslash like "/", which would make it "//evil.example".
  // Built with fromCharCode so no layer of string escaping can drop the backslash.
  const backslash = String.fromCharCode(92);
  await page.goto("/login?next=" + encodeURIComponent(`/${backslash}evil.example`));
  await expect(page).toHaveURL(/next=%2F%5Cevil\.example/);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("main").getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/$/);
});

test("a signed-in user opening the login page goes straight on", async ({ page }) => {
  await signUp(page, "Mira");
  await page.goto("/login?next=/timer");
  await expect(page).toHaveURL(/\/timer$/);
});
