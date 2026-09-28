import { test, expect } from "@playwright/test";
import { installFakeSpeech, type Speech } from "./fake-speech";

test.beforeEach(async ({ page }) => {
  await installFakeSpeech(page);
  await page.goto("/sos");
  await page.getByRole("button", { name: /Voice trigger/ }).click();
  await expect(page.getByText("Waiting to hear you...")).toBeVisible();
});

test("a call for help starts the countdown and stops listening", async ({ page }) => {
  await page.evaluate(() => (window as never as { __speech: Speech }).__speech.say("somebody please help"));
  await expect(page.getByText("Sending alert...")).toBeVisible();
  expect(await page.evaluate(() => (window as never as { __speech: Speech }).__speech.listening)).toBe(false);
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("button", { name: /Voice trigger/ })).toBeVisible();
});

test("ordinary speech is shown but doesn't trigger", async ({ page }) => {
  await page.evaluate(() => (window as never as { __speech: Speech }).__speech.say("what time is it"));
  await expect(page.getByText('Heard: "what time is it"')).toBeVisible();
  await expect(page.getByText("Sending alert...")).toHaveCount(0);
});

test("keeps listening after the browser ends a session", async ({ page }) => {
  const before = await page.evaluate(() => (window as never as { __speech: Speech }).__speech.started);
  await page.evaluate(() => (window as never as { __speech: Speech }).__speech.end());
  await expect.poll(() => page.evaluate(() => (window as never as { __speech: Speech }).__speech.started)).toBeGreaterThan(before);
  await page.evaluate(() => (window as never as { __speech: Speech }).__speech.say("help me"));
  await expect(page.getByText("Sending alert...")).toBeVisible();
});

test("a speech-service failure is shown instead of silently looping", async ({ page }) => {
  await page.evaluate(() => (window as never as { __speech: Speech }).__speech.fail("network"));
  await expect(page.getByRole("alert")).toContainText("Voice recognition needs an internet connection");
  await expect(page.getByRole("button", { name: /Voice trigger/ })).toBeVisible();
});

test("in Hindi it listens in hi-IN and responds to बचाओ", async ({ page }) => {
  await page.getByRole("button", { name: "Change language" }).click();
  await page.getByRole("menuitem", { name: /हिन्दी/ }).click();
  await expect.poll(() => page.evaluate(() => (window as never as { __speech: Speech }).__speech.lang)).toBe("hi-IN");
  await page.evaluate(() => (window as never as { __speech: Speech }).__speech.say("बचाओ"));
  await expect(page.getByText("अलर्ट भेजा जा रहा है...")).toBeVisible();
});

for (const [menu, locale, word, sending] of [
  [/தமிழ்/, "ta-IN", "உதவி", "எச்சரிக்கை அனுப்புகிறது..."],
  [/বাংলা/, "bn-IN", "বাঁচাও", "সতর্কতা পাঠানো হচ্ছে..."],
  [/मराठी/, "mr-IN", "वाचवा", "अलर्ट पाठवत आहे..."],
] as const) {
  test(`in ${locale} it listens in that language and responds to ${word}`, async ({ page }) => {
    await page.getByRole("button", { name: "Change language" }).click();
    await page.getByRole("menuitem", { name: menu }).click();
    await expect.poll(() => page.evaluate(() => (window as never as { __speech: Speech }).__speech.lang)).toBe(locale);
    await page.evaluate((w) => (window as never as { __speech: Speech }).__speech.say(w), word);
    await expect(page.getByText(sending)).toBeVisible();
  });
}

test("the listening button's label fits inside it on small screens", async ({ page }) => {
  const button = page.getByRole("button", { name: /Listening for/ });
  const box = (await button.boundingBox())!;
  const icon = (await button.locator("svg").boundingBox())!;
  const fits = await button.evaluate((el) => el.scrollWidth <= el.clientWidth + 1);
  expect(fits).toBe(true);
  expect(icon.x).toBeGreaterThanOrEqual(box.x);
});
