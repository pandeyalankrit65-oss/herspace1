import { test, expect } from "@playwright/test";
import { addConfirmedContact, failOnConsoleErrors, linkIn, readOutbox, signUp, waitForMessage } from "./helpers";

test.use({ permissions: ["geolocation"], geolocation: { latitude: 28.6139, longitude: 77.209, accuracy: 20 } });

test("SOS alerts a confirmed contact, who can follow live location until the user is safe", async ({ page, browser }) => {
  const assertNoErrors = failOnConsoleErrors(page);
  await signUp(page, "Asha");
  const mom = await addConfirmedContact(page, browser, "Mom");

  // Test alert reaches the confirmed contact and is clearly marked as a test.
  await page.reload();
  await page.getByRole("button", { name: "Send test alert" }).click();
  await expect(page.getByText("Test alert sent", { exact: true })).toBeVisible();
  const testSms = await waitForMessage((m) => m.to === mom.phone && m.body.includes("TEST alert"));
  expect(testSms.body).not.toContain("/track/");

  // Real SOS: countdown, then delivery status.
  await page.goto("/sos");
  await expect(page.getByText(/1 confirmed emergency contact\./)).toBeVisible();
  await page.getByRole("button", { name: /EMERGENCY SOS/ }).click();
  await expect(page.getByText("Sending alert...")).toBeVisible();
  await expect(page.getByText("Alert sent to 1 contact")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Sharing your live location")).toBeVisible();

  const sos = await waitForMessage((m) => m.to === mom.phone && m.body.startsWith("HerSpace SOS"));
  expect(sos.body).toContain("maps.google.com/?q=28.6139,77.209");
  expect(sos.body).toContain("Near Connaught Place, New Delhi"); // from the stubbed reverse geocoder

  // The contact opens the live link from the SMS.
  const contact = await browser.newContext();
  const contactPage = await contact.newPage();
  await contactPage.goto(linkIn(sos.body, "/track/"));
  await expect(contactPage.getByRole("heading", { name: "Asha needs help" })).toBeVisible();
  await expect(contactPage.locator(".leaflet-interactive").first()).toBeVisible();
  await expect(contactPage.getByRole("link", { name: "Get directions" })).toHaveAttribute("href", /destination=28\.6139,77\.209/);

  // The contact replies from the page, and the user sees who is coming.
  await expect(page.getByText("No one has responded yet")).toBeVisible();
  await contactPage.getByRole("button", { name: "I'm on my way" }).click();
  await expect(contactPage.getByText("Thank you. Asha can see that you're on your way.")).toBeVisible();
  await expect(page.getByText("Mom is on the way")).toBeVisible({ timeout: 20_000 });

  // "I'm safe" ends sharing; the contact sees it and no longer gets a position.
  await page.getByRole("button", { name: "I'm safe, stop sharing" }).click();
  await expect(page.getByText("Glad you're safe", { exact: true })).toBeVisible();
  await expect(page.getByText("Sharing your live location")).toBeHidden();
  await contactPage.reload();
  await expect(contactPage.getByText("Asha has marked themselves safe")).toBeVisible();
  await expect(contactPage.locator(".leaflet-container")).toHaveCount(0);
  await contact.close();

  assertNoErrors();
});

test("during an SOS, contacts see the phone's battery and the emergency info she chose to share", async ({ page, browser }) => {
  const assertNoErrors = failOnConsoleErrors(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "getBattery", { value: () => Promise.resolve({ level: 0.08, charging: false }) });
  });
  await signUp(page, "Asha");
  const mom = await addConfirmedContact(page, browser, "Mom");

  await page.goto("/account");
  await page.getByLabel("Blood group").selectOption("B+");
  await page.getByLabel("Allergies").fill("Penicillin");
  await page.getByLabel("Show this to my contacts during an SOS").click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Emergency info saved", { exact: true })).toBeVisible();

  await page.goto("/sos");
  await page.getByRole("button", { name: /EMERGENCY SOS/ }).click();
  await expect(page.getByText("Sharing your live location")).toBeVisible({ timeout: 15_000 });
  const sos = await waitForMessage((m) => m.to === mom.phone && m.body.startsWith("HerSpace SOS"));

  const contact = await browser.newContext();
  const contactPage = await contact.newPage();
  await contactPage.goto(linkIn(sos.body, "/track/"));
  await expect(contactPage.getByText("Phone battery: 8% · it may switch off soon")).toBeVisible();
  await expect(contactPage.getByRole("heading", { name: "Asha's emergency info" })).toBeVisible();
  const card = contactPage.locator("dl");
  await expect(card.getByText("B+")).toBeVisible();
  await expect(card.getByText("Penicillin")).toBeVisible();
  await expect(card.getByText("Medicines you take")).toHaveCount(0); // empty fields aren't shown
  await contact.close();

  await page.getByRole("button", { name: "I'm safe, stop sharing" }).click();
  assertNoErrors();
});

test("cancelling the countdown sends nothing", async ({ page, browser }) => {
  await signUp(page, "Neha");
  const sister = await addConfirmedContact(page, browser, "Sister");
  const before = readOutbox().length;

  await page.goto("/sos");
  await page.getByRole("button", { name: /EMERGENCY SOS/ }).click();
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.waitForTimeout(4_000);
  await expect(page.getByText(/Alert sent|NOT sent/)).toHaveCount(0);
  expect(readOutbox().slice(before).filter((m) => m.to === sister.phone)).toEqual([]);
});

test("unconfirmed contacts aren't alerted, and the user is offered to text them", async ({ page }) => {
  await signUp(page, "Priya");
  await page.getByRole("button", { name: "Add Contact" }).click();
  await page.getByLabel("Name").fill("Friend");
  await page.getByLabel("Phone (with country code)").fill("+91 90000 11111");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("Waiting for confirmation")).toBeVisible();

  await page.goto("/sos");
  await expect(page.getByText(/None of your contacts have confirmed yet/)).toBeVisible();
  await page.getByRole("button", { name: /EMERGENCY SOS/ }).click();
  await expect(page.getByText("Your alert was NOT sent automatically")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/hasn't confirmed as your contact yet/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Text Friend" })).toHaveAttribute("href", /^sms:\+919000011111\?&body=HerSpace%20SOS/);
  expect(readOutbox().filter((m) => m.to === "+919000011111" && m.body.startsWith("HerSpace SOS"))).toEqual([]);
});
