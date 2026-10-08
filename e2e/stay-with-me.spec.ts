import { test, expect } from "@playwright/test";
import { installFakeSpeech, type Speech } from "./fake-speech";
import { addConfirmedContact, signUp, waitForMessage } from "./helpers";

// Indore: no other test uses these coordinates.
test.use({ permissions: ["geolocation"], geolocation: { latitude: 22.72, longitude: 75.86, accuracy: 10 } });

test("Stay with me checks in by voice, an answer keeps it going, and two missed checks send a silent SOS", async ({ page, browser }) => {
  test.setTimeout(150_000);
  await installFakeSpeech(page);
  // A stand-in voice that remembers what it said.
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
  const reply = (text: string) => page.evaluate((t) => (window as never as { __speech: Speech }).__speech.say(t), text);

  await page.clock.install();
  await signUp(page, "Nila");
  const brother = await addConfirmedContact(page, browser, "Brother");
  await page.goto("/walk");
  await page.getByRole("button", { name: "1 hr", exact: true }).click();
  await page.getByRole("button", { name: "Start sharing" }).click();
  await expect(page.getByText("Sharing your journey", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect.poll(said).toContainEqual(expect.stringContaining("I'm here with you, Nila."));

  // Three minutes on: a check-in. She answers out loud.
  await page.clock.fastForward("03:01");
  const ask = page.getByRole("alertdialog", { name: /Are you okay\? Answer within \d+ seconds/ });
  await expect(ask).toBeVisible();
  await expect.poll(said).toContainEqual("Nila, how are you doing? Still okay?");
  await expect(page.getByText("Listening for your answer...")).toBeVisible();
  await reply("yeah I'm fine just walking");
  await expect(ask).toHaveCount(0);
  await expect.poll(said).toContainEqual("Good. I'm still here with you.");

  // The next check gets no answer, nor does the second ask: a silent SOS.
  await page.clock.fastForward("03:01");
  await expect(ask).toBeVisible();
  await page.clock.fastForward("00:31");
  await expect.poll(said).toContainEqual("Nila, are you there? Please answer, or I'll alert your contacts.");
  await page.clock.fastForward("00:31");
  const sos = await waitForMessage((m) => m.to === brother.phone && m.body.startsWith("HerSpace SOS"), 30_000);
  expect(sos.body).toContain("they stopped answering check-ins");
  expect(sos.body).toContain("DON'T call them first");
  await expect(page).toHaveURL(/\/sos$/);
});
