import { expect, test } from "@playwright/test";
import { addConfirmedContact, failOnConsoleErrors, linkIn, signUp, waitForMessage } from "./helpers";

// Bhopal: no other test uses these coordinates.
const START = { latitude: 23.26, longitude: 77.41, accuracy: 10 };
test.use({ permissions: ["geolocation"], geolocation: START });

test("contacts are told how to help, not to call during a silent SOS, and which way she's moving", async ({ page, browser, context }) => {
  const assertNoErrors = failOnConsoleErrors(page);
  await signUp(page, "Kavya");
  const friend = await addConfirmedContact(page, browser, "Friend");

  await page.goto("/sos");
  await page.getByRole("switch", { name: "Silent alert" }).click();
  await page.getByRole("button", { name: /EMERGENCY SOS/ }).click();
  await expect(page.getByText("Sharing your live location")).toBeVisible({ timeout: 15_000 });
  const sos = await waitForMessage((m) => m.to === friend.phone && m.body.startsWith("HerSpace SOS"), 20_000);

  const contact = await browser.newContext();
  const contactPage = await contact.newPage();
  await contactPage.goto(linkIn(sos.body, "/track/"));
  await expect(contactPage.getByText("Kavya pressed SOS in HerSpace. They're sharing their live location with you. Don't call or text them about this alert")).toBeVisible();
  const help = contactPage.getByRole("list").filter({ hasText: "Take a breath" });
  await expect(help).toContainText("Don't call or text about the alert");
  await expect(help).not.toContainText("Call once or twice");
  await expect(help).toContainText("Tap \"I'm on my way\"");

  // She walks about 110 m north; her phone works out the direction and pace.
  await context.setGeolocation({ ...START, latitude: START.latitude + 0.001 });
  await expect(contactPage.getByText(/Moving north/)).toBeVisible({ timeout: 40_000 });

  // Once they've said they're coming, that step goes away.
  await contactPage.getByRole("button", { name: "I'm on my way" }).click();
  await expect(help).not.toContainText("Tap \"I'm on my way\"");
  await contact.close();

  await page.getByRole("button", { name: "I'm safe, stop sharing" }).click();
  assertNoErrors();
});
