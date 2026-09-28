import { test, expect, type Page } from "@playwright/test";
import { addConfirmedContact, signUp } from "./helpers";
import { installFakeSpeech, say } from "./fake-speech";

test.use({ permissions: ["geolocation"], geolocation: { latitude: 12.9716, longitude: 77.5946 } });

test.beforeEach(async ({ page }) => {
  await installFakeSpeech(page);
});

const command = async (page: Page, phrase: string) => {
  await page.getByRole("banner").getByRole("button", { name: "Voice command" }).click();
  await expect(page.getByRole("dialog")).toContainText("Listening...");
  await say(page, phrase);
};

test("saying \"help me\" starts the SOS countdown from any page", async ({ page }) => {
  await page.goto("/map");
  await command(page, "please help me");
  await expect(page.getByText("Starting SOS...")).toBeVisible();
  await expect(page).toHaveURL(/\/sos$/);
  await expect(page.getByText("Sending alert...")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
});

test("\"fake call\" rings straight away, and \"sound the alarm\" starts the alarm", async ({ page }) => {
  await page.goto("/");
  await command(page, "fake call");
  await expect(page.getByRole("dialog", { name: "Incoming call" })).toBeVisible();
  await page.getByRole("button", { name: "Decline" }).click();

  await command(page, "sound the alarm");
  await expect(page.getByRole("alertdialog", { name: "Alarm sounding" })).toBeVisible();
  await page.getByRole("button", { name: "Stop alarm" }).click();
});

test("\"call Mom\" finds the contact, in English or Hindi", async ({ page, browser }) => {
  await signUp(page, "Asha");
  await addConfirmedContact(page, browser, "Mom");
  await page.goto("/");
  await command(page, "call Mom");
  await expect(page.getByText("Calling Mom...")).toBeVisible();

  await page.goto("/");
  await page.getByRole("button", { name: "Change language" }).click();
  await page.getByRole("menuitem", { name: /हिन्दी/ }).click();
  await page.getByRole("banner").getByRole("button", { name: "आवाज़ से आदेश" }).click();
  await say(page, "मम्मी को कॉल करो");
  await expect(page.getByText("Mom को कॉल कर रहे हैं...")).toBeVisible();
});

test("\"start a 45 minute timer\" opens the timer with 45 minutes chosen", async ({ page }) => {
  await signUp(page, "Riya");
  await command(page, "start a 45 minute timer");
  await expect(page.getByText("Setting up a 45 minute timer...")).toBeVisible();
  await expect(page).toHaveURL(/\/timer\?minutes=45$/);
  await expect(page.getByRole("button", { name: "45 min", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("\"I'm taking a cab\" opens ride sharing, and unknown phrases get suggestions", async ({ page }) => {
  await signUp(page, "Tanu");
  await command(page, "I'm taking a cab home");
  await expect(page).toHaveURL(/\/walk\?type=ride$/);
  await expect(page.getByRole("tab", { name: "Cab or auto" })).toHaveAttribute("aria-selected", "true");

  await command(page, "what's the weather like");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("I didn't catch a command");
  await expect(dialog).toContainText("Call Mom");
});

test("the support chat takes a spoken message", async ({ page }) => {
  await page.goto("/support");
  await page.getByRole("button", { name: "Speak your message" }).click();
  await say(page, "I feel unsafe walking home");
  await expect(page.getByText("I feel unsafe walking home").first()).toBeVisible();
  // A reply arrives (scripted in tests, since there's no AI key).
  await expect(page.getByRole("status", { name: "Writing a reply" })).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Read replies aloud" })).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Read replies aloud" }).click();
  await expect(page.getByRole("button", { name: "Read replies aloud" })).toHaveAttribute("aria-pressed", "true");
});
