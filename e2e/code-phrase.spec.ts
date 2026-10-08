import { test, expect } from "@playwright/test";
import { installFakeSpeech, type Speech } from "./fake-speech";
import { addConfirmedContact, signUp, waitForMessage } from "./helpers";

const say = (text: string) => (window as never as { __speech: Speech }).__speech.say(text);

test("saying the code phrase aloud sends a silent SOS straight away, and contacts are told why", async ({ page, browser }) => {
  await installFakeSpeech(page);
  await signUp(page, "Tara");
  const cousin = await addConfirmedContact(page, browser, "Cousin");

  await page.goto("/account");
  await page.getByRole("textbox", { name: "Code phrase" }).fill("Is the blue kettle fixed yet?");
  await page.getByRole("button", { name: "Save and tell my contacts" }).click();
  await expect(page.getByText("Code phrase saved. 1 contact was told what it means.", { exact: true })).toBeVisible();

  await page.goto("/sos");
  await page.getByRole("button", { name: /Voice trigger/ }).click();
  await expect(page.getByText('Saying your code phrase ("Is the blue kettle fixed yet?") sends a silent SOS straight away')).toBeVisible();

  // Ordinary talk about kettles does nothing.
  await page.evaluate(say, "the kettle is blue");
  await expect(page.getByText('Heard: "the kettle is blue"')).toBeVisible();

  // The phrase, with a word misheard, inside a sentence.
  await page.evaluate(say, "hey is the blue cattle fixed yet");
  const sos = await waitForMessage((m) => m.to === cousin.phone && m.body.startsWith("HerSpace SOS"), 20_000);
  expect(sos.body).toContain("They said their code phrase");
  expect(sos.body).toContain("DON'T call them first");
  // No countdown to cancel: it went straight away.
  await expect(page.getByRole("button", { name: "Cancel" })).toHaveCount(0);
});
