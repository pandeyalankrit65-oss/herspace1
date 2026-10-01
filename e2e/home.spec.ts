import { test, expect } from "@playwright/test";
import { addConfirmedContact, signUp } from "./helpers";

test.use({ permissions: ["geolocation"], geolocation: { latitude: 12.9716, longitude: 77.5946 } });

test("the landing page shows help for each situation, and switches language from its cards", async ({ page }) => {
  await page.goto("/");
  // The phone mockup describes itself to screen readers.
  await expect(page.getByRole("img", { name: "Example: what you see in HerSpace during an SOS" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Call 112" })).toHaveAttribute("href", "tel:112");

  const tabs = page.getByRole("tablist", { name: "For every situation" });
  await expect(tabs.getByRole("tab")).toHaveCount(6);
  await expect(page.getByRole("tabpanel")).toContainText("Walking home at night");
  await tabs.getByRole("tab", { name: "Cab or auto" }).click();
  await expect(page.getByRole("tabpanel")).toContainText("vehicle number");
  await expect(page.getByRole("tabpanel").getByRole("link", { name: "Share a ride" })).toHaveAttribute("href", "/walk?type=ride");
  // Arrow keys move between tabs.
  await page.keyboard.press("ArrowRight");
  await expect(tabs.getByRole("tab", { name: "Meeting someone" })).toBeFocused();
  await expect(tabs.getByRole("tab", { name: "Meeting someone" })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("End");
  await expect(page.getByRole("tabpanel")).toContainText("Online harassment");

  await page.getByRole("button", { name: /हिन्दी/ }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
  await expect(page.getByRole("heading", { name: "हर पल के हिसाब से मदद" })).toBeVisible();
  await expect(page.getByRole("button", { name: /हिन्दी/ })).toHaveAttribute("aria-pressed", "true");
});

test("signed-in users get a dashboard with SOS first; visitors get the landing page", async ({ page, browser }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Ready in two minutes" })).toBeVisible();

  await signUp(page, "Meera");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Meera" })).toBeVisible();
  await expect(page.getByText("No one will be alerted yet.", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ready in two minutes" })).toHaveCount(0);

  await page.goto("/contacts");
  await addConfirmedContact(page, browser, "Mom");
  await page.goto("/");
  await expect(page.getByText("1 confirmed contact will get your location when you press SOS.")).toBeVisible();
  await page.getByRole("link", { name: "Open SOS" }).click();
  await expect(page).toHaveURL(/\/sos$/);
  await expect(page.getByRole("button", { name: /EMERGENCY SOS/ })).toBeInViewport();
});

test("offline, the dashboard still shows the contacts kept on the device", async ({ page, browser, context }) => {
  await signUp(page, "Zara");
  await addConfirmedContact(page, browser, "Sister");
  await page.goto("/sos"); // stores the offline copy of the contacts
  await expect(page.getByText(/1 confirmed emergency contact\./)).toBeVisible();

  await context.setOffline(true);
  // Navigate inside the app (no reload), as someone would after losing signal.
  await page.getByRole("banner").getByRole("link", { name: "HerSpace", exact: true }).click();
  await expect(page.getByText(/You're offline, so HerSpace can't send alerts/)).toBeVisible();
  await expect(page.getByText("1 confirmed contact will get your location when you press SOS.")).toBeVisible();
  await expect(page.getByText("No one will be alerted yet.", { exact: false })).toHaveCount(0);
  await context.setOffline(false);
});

test("removing a contact asks first", async ({ page, browser }) => {
  await signUp(page, "Isha");
  await addConfirmedContact(page, browser, "Aunt");
  await page.reload();
  await page.getByRole("button", { name: "Remove Aunt" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("Remove Aunt?");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("Aunt", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Remove Aunt" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText("Aunt", { exact: true })).toHaveCount(0);
});

test("a conversation starter sends that message", async ({ page }) => {
  await page.goto("/support");
  await page.getByRole("button", { name: "Help me calm down" }).click();
  await expect(page.getByText("Help me calm down").first()).toBeVisible();
  // The starters are only offered before the first message.
  await expect(page.getByRole("button", { name: "I feel unsafe right now" })).toHaveCount(0);
});

test("a new page opens at the top, not at the previous page's scroll position", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.getByRole("contentinfo").getByRole("link", { name: "Safety Timer" }).click();
  await expect(page).toHaveURL(/\/timer$/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});
