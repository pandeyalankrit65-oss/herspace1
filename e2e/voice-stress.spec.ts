import { test, expect, type Page } from "@playwright/test";
import { openSosSettings } from "./helpers";

// A stand-in microphone: a voice-like tone whose pitch and loudness the test controls.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const ctx = new AudioContext();
      // Like a real microphone after a reload: sound only flows once the page has been tapped.
      void ctx.resume();
      window.addEventListener("pointerdown", () => void ctx.resume());
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = 200;
      const gain = ctx.createGain();
      gain.gain.value = 0.15;
      (window as unknown as { voice: (hz: number, level: number) => void }).voice = (hz, level) => {
        osc.frequency.value = hz;
        gain.gain.value = level;
      };
      const dest = ctx.createMediaStreamDestination();
      osc.connect(gain).connect(dest);
      osc.start();
      return dest.stream;
    };
  });
});

const voice = (page: Page, hz: number, level: number) =>
  page.evaluate(([h, l]) => (window as unknown as { voice: (hz: number, level: number) => void }).voice(h, l), [hz, level]);

test("voice stress (experiment): learns her calm voice, then asks if she's okay, and never sends SOS by itself", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/sos");
  await openSosSettings(page);
  await page.getByRole("switch", { name: /Notice stress in my voice/ }).click();
  await page.getByRole("button", { name: "Learn my calm voice" }).click();
  await expect(page.getByText("Keep talking normally...")).toBeVisible();
  await expect(page.getByText("Listening for stress in your voice")).toBeVisible({ timeout: 15_000 });

  // Her usual voice: no question.
  await page.waitForTimeout(3500);
  await expect(page.getByRole("alertdialog")).toHaveCount(0);

  // Higher and louder.
  await voice(page, 300, 0.5);
  const ask = page.getByRole("alertdialog", { name: "You sound stressed. Are you okay?" });
  await expect(ask).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Sending alert...")).toHaveCount(0);
  await ask.getByRole("button", { name: "I'm okay" }).click();
  await expect(ask).toHaveCount(0);

  // The baseline is remembered on the phone. After a reload the browser needs a tap before any
  // sound flows, and the page says so instead of pretending to listen.
  // Checked with the settings folded: opening them is itself a tap, which would start the sound.
  await page.reload();
  await expect(page.getByText(/Tap anywhere on the page to start listening/)).toBeVisible();
  await page.getByRole("heading").first().click();
  await expect(page.getByText("Listening for stress in your voice")).toBeVisible();
});
