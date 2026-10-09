import { test, expect, type Page } from "@playwright/test";
import { addConfirmedContact, signUp, waitForMessage } from "./helpers";

test.use({ permissions: ["geolocation"], geolocation: { latitude: 26.8467, longitude: 80.9462 } });

async function press(page: Page, keys: string) {
  for (const k of keys) await page.getByRole("button", { name: k, exact: true }).click();
}

test("disguised mode: a working calculator, a PIN to open the app and a silent SOS code", async ({ page, browser, context }) => {
  await signUp(page, "Asha");
  const mom = await addConfirmedContact(page, browser, "Mom");

  await page.goto("/account");
  await page.getByLabel("PIN (4 to 8 digits)").fill("2468");
  await page.getByLabel("PIN again").fill("2468");
  await page.getByLabel("SOS code (optional)").fill("1357");
  await page.getByRole("button", { name: "Turn on disguised mode" }).click();
  await page.getByRole("button", { name: "Lock now" }).click();

  const calculator = page.getByRole("main", { name: "Calculator" });
  await expect(calculator).toBeVisible();
  await expect(page).toHaveTitle("Calculator");
  await expect(page.getByText("HerSpace")).toHaveCount(0);

  // It really calculates.
  await press(page, "12+30=");
  await expect(calculator.locator("output")).toHaveText("42");

  // The SOS code sends a silent alert, and the screen stays an ordinary calculator.
  await press(page, "C1357=");
  const sms = await waitForMessage((m) => m.to === mom.phone && m.body.startsWith("HerSpace SOS"));
  expect(sms.body).toContain("DON'T call them or mention this alert");
  await expect(calculator).toBeVisible();
  await expect(calculator.locator("output")).toHaveText("0");

  // The PIN opens the app.
  await press(page, "2468=");
  await expect(page.getByRole("heading", { name: "Your account" })).toBeVisible();

  // A new tab starts locked; links meant for contacts still open normally.
  const other = await context.newPage();
  await other.goto("/sos");
  await expect(other.getByRole("main", { name: "Calculator" })).toBeVisible();
  await other.goto("/track/some-token");
  await expect(other.getByRole("main", { name: "Calculator" })).toHaveCount(0);
  await other.close();

  // Turning it off.
  await page.getByRole("button", { name: "Turn off" }).click();
  await expect(page.getByRole("button", { name: "Turn on disguised mode" })).toBeVisible();
});

test("quick exit leaves for an ordinary page and can't be undone with Back", async ({ page }) => {
  await page.route("https://www.google.com/**", (route) => route.fulfill({ contentType: "text/html", body: "<title>weather</title>weather" }));
  await signUp(page, "Neha");
  await page.goto("/account");
  await page.getByRole("switch", { name: "Quick exit button" }).click();
  await page.goto("/sos");
  await page.getByRole("button", { name: "Exit", exact: true }).click();
  await expect(page).toHaveURL(/google\.com\/search\?q=weather/);
  await page.goBack();
  await expect(page).not.toHaveURL(/\/sos$/);
});

test("a silent SOS asks contacts not to call, and the code phrase is explained to contacts", async ({ page, browser }) => {
  await signUp(page, "Priya");
  const sister = await addConfirmedContact(page, browser, "Sister");

  await page.goto("/sos");
  await page.getByRole("switch", { name: "Silent alert" }).click();
  await page.getByRole("button", { name: /EMERGENCY SOS/ }).click();
  const sms = await waitForMessage((m) => m.to === sister.phone && m.body.startsWith("HerSpace SOS"), 20_000);
  expect(sms.body).toContain("DON'T call them or mention this alert");

  await page.goto("/account");
  await page.getByRole("textbox", { name: "Code phrase" }).fill("Did you buy the red umbrella?");
  await page.getByRole("button", { name: "Save and tell my contacts" }).click();
  await expect(page.getByText("Code phrase saved. 1 contact was told what it means.", { exact: true })).toBeVisible();
  const told = await waitForMessage((m) => m.to === sister.phone && m.body.includes("code phrase"));
  expect(told.body).toContain('"Did you buy the red umbrella?"');
});
