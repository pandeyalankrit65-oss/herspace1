import { test, expect } from "@playwright/test";
import { installFakeSpeech, type Speech } from "./fake-speech";

test("the fake caller listens and answers what she says", async ({ page }) => {
  await installFakeSpeech(page);
  // A stand-in voice that remembers what the caller said.
  await page.addInitScript(() => {
    const said: string[] = [];
    (window as never as { __said: string[] }).__said = said;
    Object.defineProperty(window, "speechSynthesis", {
      value: {
        speak: (u: SpeechSynthesisUtterance) => {
          said.push(u.text);
          setTimeout(() => u.onend?.(new Event("end") as SpeechSynthesisEvent), 10);
        },
        cancel: () => {},
        getVoices: () => [],
      },
    });
  });
  const said = () => page.evaluate(() => (window as never as { __said: string[] }).__said);
  const listening = () => page.evaluate(() => (window as never as { __speech: Speech }).__speech.listening);
  const reply = (text: string) => page.evaluate((t) => (window as never as { __speech: Speech }).__speech.say(t), text);

  await page.goto("/sos");
  await page.getByLabel("Caller name").fill("Didi");
  await page.getByRole("button", { name: "Now", exact: true }).click();
  await page.getByRole("button", { name: "Schedule call" }).click();
  const call = page.getByRole("dialog", { name: "Incoming call" });
  await call.getByRole("button", { name: "Accept" }).click();

  // The opening script, then it listens.
  await expect.poll(said).toHaveLength(1);
  await expect.poll(listening).toBe(true);

  // Without the AI here, scripted caller lines answer in turn.
  await reply("hi I'm near the bus stop");
  await expect.poll(said).toContainEqual("Where are you exactly? I'm nearly there.");
  await expect.poll(listening).toBe(true);
  // "Help" in conversation is just talk on a call: no SOS countdown.
  await reply("can you help me find the road");
  await expect.poll(said).toContainEqual("Okay, stay where there are people. I can see the main road.");
  await expect(page.getByText("Sending alert...")).toHaveCount(0);

  await call.getByRole("button", { name: "End call" }).click();
  await expect.poll(listening).toBe(false);
});
