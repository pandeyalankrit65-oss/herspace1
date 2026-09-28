import { expect, type Page } from "@playwright/test";

// Real speech can't be fed to a headless browser, so replace the Web Speech API with a fake
// the test drives: say(text) delivers a transcript, fail(code) an error, end() a session end.
export async function installFakeSpeech(page: Page) {
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
      said: unknown[] = [];
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
        // Like a real continuous session, earlier phrases stay in the results list.
        say(text: string) {
          const r = current();
          if (!r) return;
          r.said.push(Object.assign([{ transcript: text }], { isFinal: true }));
          r.onresult?.({ resultIndex: r.said.length - 1, results: r.said });
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

export type Speech = { started: number; lang?: string; listening: boolean; say(t: string): void; fail(e: string): void; end(): void };

// Waits until the app is listening, then "speaks" the phrase.
export async function say(page: Page, text: string) {
  await expect.poll(() => page.evaluate(() => (window as never as { __speech: Speech }).__speech.listening)).toBe(true);
  await page.evaluate((t) => (window as never as { __speech: Speech }).__speech.say(t), text);
}
