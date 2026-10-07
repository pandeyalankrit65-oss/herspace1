import fs from "fs";
import { expect, type Browser, type Page } from "@playwright/test";

export type OutboxMessage = { channel: "sms" | "call" | "email" | "webhook"; to: string; body: string; subject?: string; sid: string; at: string };

export function readOutbox(): OutboxMessage[] {
  const file = process.env.E2E_OUTBOX!;
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

// Waits for a message the server "sent" (written to the outbox) that matches.
export async function waitForMessage(match: (m: OutboxMessage) => boolean, timeout = 10_000): Promise<OutboxMessage> {
  let found: OutboxMessage | undefined;
  await expect
    .poll(() => (found = readOutbox().reverse().find(match)), { timeout, message: "message in outbox" })
    .toBeTruthy();
  return found!;
}

export const linkIn = (text: string, path: string) => {
  const url = new RegExp(`https?://\\S+${path}\\S+`).exec(text)?.[0];
  expect(url, `link containing ${path}`).toBeTruthy();
  return url!.replace(/[.,]$/, "");
};

let counter = 0;
export const uniqueEmail = (tag: string) => `${tag}.${Date.now()}.${++counter}@example.com`;
// A different Indian mobile number per test, so contacts never collide.
export const uniquePhone = () => `+9198${String(Date.now()).slice(-6)}${String(++counter % 100).padStart(2, "0")}`;

export async function signUp(page: Page, name = "Asha", email = uniqueEmail("user")) {
  await page.goto("/signup");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/contacts$/);
  return { name, email };
}

// Adds a contact and accepts the invite as that contact in a separate, logged-out browser.
export async function addConfirmedContact(page: Page, browser: Browser, name = "Mom") {
  const phone = uniquePhone();
  await page.getByRole("button", { name: "Add Contact" }).click();
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Phone (with country code)").fill(phone);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(`Ask ${name} to confirm`);
  await page.getByRole("button", { name: "Done" }).click();

  const invite = await waitForMessage((m) => m.channel === "sms" && m.to === phone.replace(/\s/g, "") && m.body.includes("/confirm-contact/"));
  const contactContext = await browser.newContext();
  const contactPage = await contactContext.newPage();
  await contactPage.goto(linkIn(invite.body, "/confirm-contact/"));
  await contactPage.getByRole("button", { name: /Yes, I'll be a contact/ }).click();
  await expect(contactPage.getByText(/You're confirmed/)).toBeVisible();
  await contactContext.close();
  return { name, phone };
}

// Fails the test on uncaught errors or console errors, apart from expected 4xx responses.
export function failOnConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource: the server responded with a status of 4\d\d/.test(m.text())) {
      errors.push(`console: ${m.text()}`);
    }
  });
  return () => expect(errors, "console errors").toEqual([]);
}
