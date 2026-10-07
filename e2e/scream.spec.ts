import { test, expect } from "@playwright/test";

// A stand-in microphone: silent until the test "screams", then a loud 1.5 kHz sawtooth, which
// has a scream's loudness and its energy in the 0.7-4 kHz band.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const ctx = new AudioContext();
      await ctx.resume();
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = 1500;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      (window as unknown as { scream: (on: boolean) => void }).scream = (on) => (gain.gain.value = on ? 0.9 : 0);
      const dest = ctx.createMediaStreamDestination();
      osc.connect(gain).connect(dest);
      osc.start();
      return dest.stream;
    };
  });
});

const scream = (page: import("@playwright/test").Page, on: boolean) =>
  page.evaluate((v) => (window as unknown as { scream: (on: boolean) => void }).scream(v), on);

test("listening for screams: off by default, testable without starting SOS, then starts the countdown", async ({ page }) => {
  await page.goto("/sos");
  const toggle = page.getByRole("switch", { name: "Listen for screams" });
  await expect(toggle).not.toBeChecked();

  await toggle.click();
  await expect(page.getByText("Listening for screams")).toBeVisible();

  // Test mode: a scream is recognised but SOS doesn't start.
  await page.getByRole("button", { name: "Test it" }).click();
  await expect(page.getByText("Listening for screams")).toBeVisible();
  await scream(page, true);
  await expect(page.getByText("That would have started SOS.")).toBeVisible();
  await expect(page.getByText("Sending alert...")).toHaveCount(0);
  await scream(page, false);
  await page.getByRole("button", { name: "Stop testing" }).click();
  await expect(page.getByText("Listening for screams")).toBeVisible();

  // A short burst isn't enough; a sustained scream starts the cancellable countdown.
  await scream(page, true);
  await page.waitForTimeout(300);
  await scream(page, false);
  await page.waitForTimeout(1000);
  await expect(page.getByText("Sending alert...")).toHaveCount(0);
  await scream(page, true);
  await expect(page.getByText("Sending alert...")).toBeVisible({ timeout: 4000 });
  await scream(page, false);
  await page.getByRole("button", { name: "Cancel" }).click();

  // Remembered.
  await page.reload();
  await expect(page.getByRole("switch", { name: "Listen for screams" })).toBeChecked();
});
