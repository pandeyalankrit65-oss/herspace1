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
  // Phones: the bottom bar's "More" sheet. Desktop: the account menu in the top bar.
  if (test.info().project.name === "phone") {
    await page.getByRole("button", { name: "More", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Log out" }).click();
  } else {
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Log out" }).click();
  }
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

test("sign-up looks the same whether or not the email has an account, and only the inbox can finish it", async ({ page, browser }) => {
  const { email } = await signUp(page, "Kavya");

  // Someone else tries her email: the page says the same as for a new one, and she gets a note.
  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  await other.goto("/signup");
  await other.getByLabel("Name").fill("Someone");
  await other.getByLabel("Email").fill(email);
  await other.getByRole("button", { name: "Continue" }).click();
  await expect(other.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await expect(other.getByText(`If ${email} is new to HerSpace`)).toBeVisible();
  const note = await waitForMessage((m) => m.channel === "email" && m.to === email && m.subject === "You already have a HerSpace account");
  expect(note.body).toContain("nothing has changed");
  await otherContext.close();

  // A new address, with a page to come back to: the link finishes it and goes there.
  const fresh = uniqueEmail("fresh");
  const newContext = await browser.newContext();
  const newcomer = await newContext.newPage();
  await newcomer.goto("/signup?next=%2Fsafety-plan");
  await newcomer.getByLabel("Name").fill("Nila");
  await newcomer.getByLabel("Email").fill(fresh);
  await newcomer.getByRole("button", { name: "Continue" }).click();
  await expect(newcomer.getByRole("link", { name: "SOS" }).last()).toBeVisible();
  const invite = await waitForMessage((m) => m.channel === "email" && m.to === fresh && m.subject === "Finish creating your HerSpace account");
  const link = linkIn(invite.body, "/finish-signup/");
  await newcomer.goto(link);
  await expect(newcomer.getByText(`Choose a password for ${fresh}.`)).toBeVisible();
  await newcomer.getByLabel("Password", { exact: true }).fill("password123");
  await newcomer.getByLabel("Password again").fill("password456");
  await newcomer.getByRole("button", { name: "Create account" }).click();
  await expect(newcomer.getByRole("alert")).toBeVisible();
  await newcomer.getByLabel("Password again").fill("password123");
  await newcomer.getByRole("button", { name: "Create account" }).click();
  await expect(newcomer).toHaveURL(/\/safety-plan$/);

  // The link only works once.
  await newcomer.goto(link);
  await expect(newcomer.getByText("This link has expired or has already been used.")).toBeVisible();
  await newContext.close();
});
