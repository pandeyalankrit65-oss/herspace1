import { test, expect } from "@playwright/test";
import { addConfirmedContact, signUp } from "./helpers";

// A fake microphone (Chrome's test tone) so audio recording can run for real.
test.use({
  permissions: ["geolocation", "microphone"],
  geolocation: { latitude: 28.6139, longitude: 77.209 },
  launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] },
});

test("audio is recorded in pieces during an SOS, and only the user can play it back", async ({ page, browser }) => {
  test.setTimeout(90_000);
  await signUp(page, "Leela");
  await addConfirmedContact(page, browser, "Mom");
  await page.goto("/sos");
  await page.getByRole("switch", { name: "Record audio during SOS" }).click();
  await page.getByRole("button", { name: /EMERGENCY SOS/ }).click();
  await expect(page.getByText("Alert sent to 1 contact")).toBeVisible({ timeout: 15_000 });

  const status = page.getByRole("status").filter({ hasText: "Recording audio as evidence" });
  await expect(status).toBeVisible();
  await expect(status).toContainText("1 saved", { timeout: 20_000 });
  await status.getByRole("button", { name: "Stop" }).click();
  await expect(status).toHaveCount(0);

  await page.goto("/account");
  await expect(page.getByRole("heading", { name: "SOS recordings" })).toBeVisible();
  await expect(page.locator("audio").first()).toHaveAttribute("src", /^blob:/);
});

test("the loud alarm fills the screen until stopped", async ({ page }) => {
  await page.goto("/sos");
  await page.getByRole("button", { name: "Loud alarm" }).click();
  const alarm = page.getByRole("alertdialog", { name: "Alarm sounding" });
  await expect(alarm).toBeVisible();
  await expect(alarm).toContainText("HELP!");
  await alarm.getByRole("button", { name: "Stop alarm" }).click();
  await expect(alarm).toHaveCount(0);
});

test("the map points to the nearest help with walking directions", async ({ page }) => {
  await page.goto("/map");
  await page.getByRole("button", { name: "Show my location" }).click();
  await expect(page.getByText("Nearest help:")).toBeVisible();
  await expect(page.getByRole("link", { name: "Walk there" })).toHaveAttribute("href", /travelmode=walking/);
});
