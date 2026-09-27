import { test, expect } from "@playwright/test";
import { linkIn, signUp, uniqueEmail, waitForMessage } from "./helpers";

test("the session lives in an HttpOnly cookie that page scripts can't read", async ({ page, context }) => {
  await signUp(page, "Meera");
  const cookie = (await context.cookies()).find((c) => c.name === "herspace_session");
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe("Lax");
  expect(await page.evaluate(() => document.cookie)).not.toContain("herspace_session");
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toMatch(/token/i);

  // Still signed in after a reload, and signed out after logging out.
  await page.goto("/account");
  await expect(page.getByRole("heading", { name: "Your account" })).toBeVisible();
  await page.goto("/");
  if (await page.getByRole("button", { name: "Open menu" }).isVisible()) await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("button", { name: /^Log out/ }).click();
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login\?next=%2Faccount|\/login\?next=\/account/);
});

test("password reset by email", async ({ page }) => {
  const email = uniqueEmail("reset");
  await signUp(page, "Ritu", email);
  await page.context().clearCookies();

  await page.goto("/login");
  await page.getByRole("link", { name: "Forgot password?" }).click();
  // Wait for the reset page: otherwise the login page's Email field can be filled just before it's replaced.
  await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText(/If an account exists/)).toBeVisible();

  const mail = await waitForMessage((m) => m.channel === "email" && m.to === email);
  await page.goto(linkIn(mail.body, "/reset-password/"));
  await page.getByLabel("New password", { exact: true }).fill("a-new-password");
  await page.getByLabel("Confirm new password").fill("a-new-password");
  await page.getByRole("button", { name: "Set new password" }).click();
  await expect(page).toHaveURL(/\/$/);

  // The new password works; the old one doesn't.
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("main").getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("alert")).toContainText("Incorrect email or password");
  await page.getByLabel("Password").fill("a-new-password");
  await page.getByRole("main").getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/$/);
});
