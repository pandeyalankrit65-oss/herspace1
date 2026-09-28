import { test, expect, type Page } from "@playwright/test";
import { installFakeSpeech, say } from "./fake-speech";

test.beforeEach(async ({ page }) => {
  await installFakeSpeech(page);
  await page.goto("/sos");
});

async function setSafeWord(page: Page, word: string, helpWords = true) {
  await page.getByRole("button", { name: "Set", exact: true }).click();
  await page.getByLabel("Safe word").fill(word);
  if (!helpWords) await page.getByRole("switch", { name: /Also respond to/ }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText(`Your safe word is "${word}"`)).toBeVisible();
}

const countdown = (page: Page) => page.getByText("Sending alert...");

test("saying the safe word 3 times starts SOS; once or twice doesn't", async ({ page }) => {
  await setSafeWord(page, "pineapple");
  await page.getByRole("button", { name: /Voice trigger/ }).click();
  await expect(page.getByText(/or your safe word "pineapple" 3 times/)).toBeVisible();

  await say(page, "I'd like some pineapple");
  await say(page, "pineapple juice please");
  await page.waitForTimeout(500);
  await expect(countdown(page)).toHaveCount(0);

  await say(page, "pineapple");
  await expect(countdown(page)).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
});

test("with the help words off, only the safe word starts SOS", async ({ page }) => {
  await setSafeWord(page, "blue moon", false);
  await page.getByRole("button", { name: /Voice trigger/ }).click();
  await expect(page.getByText(/^Say your safe word "blue moon" 3 times/)).toBeVisible();

  await say(page, "help help help");
  await page.waitForTimeout(500);
  await expect(countdown(page)).toHaveCount(0);

  await say(page, "blue moon, blue moon, blue moon");
  await expect(countdown(page)).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
});

test("the safe word can be tested before saving, and removed", async ({ page }) => {
  await page.getByRole("button", { name: "Set", exact: true }).click();
  await page.getByLabel("Safe word").fill("mango");
  await page.getByRole("button", { name: "Test my safe word" }).click();
  await say(page, "mango mango mango");
  await expect(page.getByText("That works.")).toBeVisible();

  await page.getByRole("button", { name: "Test my safe word" }).click();
  await say(page, "mango tango");
  await expect(page.getByText("Heard it 1 of 3 times.", { exact: false })).toBeVisible();

  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.reload();
  await expect(page.getByText('Your safe word is "mango"')).toBeVisible();
  await page.getByRole("button", { name: "Change", exact: true }).click();
  await page.getByRole("button", { name: "Remove safe word" }).click();
  await expect(page.getByText(/Choose your own word/)).toBeVisible();
});
