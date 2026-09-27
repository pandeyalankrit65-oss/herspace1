import { test, expect } from "@playwright/test";
import { addConfirmedContact, failOnConsoleErrors, linkIn, signUp, waitForMessage } from "./helpers";

test.use({ permissions: ["geolocation"], geolocation: { latitude: 28.6139, longitude: 77.209, accuracy: 20 } });

test("walk with me shares a journey without raising an alarm", async ({ page, browser }) => {
  const assertNoErrors = failOnConsoleErrors(page);
  await signUp(page, "Asha");
  const friend = await addConfirmedContact(page, browser, "Riya");

  await page.goto("/walk");
  await page.getByRole("button", { name: "1 hr", exact: true }).click();
  await page.getByLabel("Where are you going? (optional)").fill("Metro to home");
  await page.getByRole("button", { name: "Start sharing" }).click();
  await expect(page.getByText("1 contact was sent a link to follow you.", { exact: true })).toBeVisible();
  await expect(page.getByText("Sharing your journey", { exact: true })).toBeVisible();

  const sms = await waitForMessage((m) => m.to === friend.phone && m.body.includes("while they travel"));
  expect(sms.body).not.toContain("SOS");

  const contact = await browser.newContext();
  const contactPage = await contact.newPage();
  await contactPage.goto(linkIn(sms.body, "/track/"));
  await expect(contactPage.getByRole("heading", { name: "Asha is sharing their journey with you" })).toBeVisible();
  await expect(contactPage.getByText("Metro to home")).toBeVisible();
  await contactPage.getByRole("button", { name: "I'm keeping an eye out" }).click();
  await expect(page.getByText("Riya is following your journey")).toBeVisible({ timeout: 20_000 });

  await page.getByRole("button", { name: "I've arrived, stop sharing" }).click();
  await expect(page.getByText("Glad you made it", { exact: true })).toBeVisible();
  await contactPage.reload();
  await expect(contactPage.getByText("Asha has stopped sharing their journey")).toBeVisible();
  await contact.close();

  assertNoErrors();
});

test("walk with me asks for a login first", async ({ page }) => {
  await page.goto("/walk");
  await expect(page.getByText("Log in and add an emergency contact to share your journey.")).toBeVisible();
});
