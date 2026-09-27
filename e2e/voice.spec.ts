import { test, expect, type Page } from "@playwright/test";

// Real speech can't be fed to a headless browser, so replace the Web Speech API with a fake
// the test drives: say(text) delivers a transcript, fail(code) an error, end() a session end.
async function installFakeSpeech(page: Page) {
  await page.addInitScript(() => {
    type Handler = ((e: unknown) => void) | null;
    const speech = { instances: [] as FakeRecognition[], started: 0 };
    class FakeRecognition {
      continuous = false;
      interimResults = false;
      lang = "";
      onresult: Handler = null;
      onerror: Handler = null;
      onend: (() => void) | null = null;
      running = false;
      constructor() {
        speech.instances.push(this);
      }
      start() {
        this.running = true;
        speech.started++;
      }
      stop() {
        this.running = false;
      }
      abort() {
        this.running = false;
      }
    }
    const current = () => speech.instances.filter((r) => r.running).pop();
    Object.assign(window, {
      SpeechRecognition: FakeRecognition,
      __speech: {
        get started() {
          return speech.started;
        },
        get lang() {
          return current()?.lang;
        },
        get listening() {
          return Boolean(current());
        },
        say(text: string) {
          current()?.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: text }], { isFinal: true })] });
        },
        fail(error: string) {
          const r = current();
          r?.onerror?.({ error });
          if (r) r.running = false;
          r?.onend?.();
        },
        end() {
          const r = current();
          if (r) r.running = false;
          r?.onend?.();
        },
      },
    });
  });
}

type Speech = { started: number; lang?: string; listening: boolean; say(t: string): void; fail(e: string): void; end(): void };

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
  await expect.poll(() => page.evaluate(() => (window as never as { __speech: Speech }).__speech.lang)).toBe("hi-IN");
  await page.evaluate(() => (window as never as { __speech: Speech }).__speech.say("बचाओ"));
  await expect(page.getByText("अलर्ट भेजा जा रहा है...")).toBeVisible();
});
