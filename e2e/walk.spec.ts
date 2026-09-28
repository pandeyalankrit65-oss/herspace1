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

test("a journey to a saved place stops by itself on arrival, and contacts get a text", async ({ page, browser, context }) => {
  test.setTimeout(120_000);
  const assertNoErrors = failOnConsoleErrors(page);
  const home = { latitude: 28.6315, longitude: 77.2167, accuracy: 20 }; // about 2 km from the start
  await signUp(page, "Asha");
  const friend = await addConfirmedContact(page, browser, "Riya");

  // Save Home while standing there: the pin starts at the current position.
  await context.setGeolocation(home);
  await page.goto("/account");
  await page.getByRole("button", { name: "Add a place" }).click();
  await expect(page.getByLabel("Name")).toHaveValue("Home");
  await expect(page.getByTestId("place-map").locator(".leaflet-interactive")).toBeVisible();
  await page.getByRole("button", { name: "Save place" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Home" })).toBeVisible();
  const saved = await page.evaluate(() => localStorage.getItem("herspace_places"));
  expect(saved).toContain('"label":"Home"');

  // Start a walk from somewhere else, heading Home.
  await context.setGeolocation({ latitude: 28.6139, longitude: 77.209, accuracy: 20 });
  await page.goto("/walk");
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await page.getByRole("button", { name: "Start sharing" }).click();
  await expect(page.getByText("Heading to Home. Sharing stops by itself when you get there.")).toBeVisible();
  const sms = await waitForMessage((m) => m.to === friend.phone && m.body.includes("while they travel"));
  expect(sms.body).toContain("They're heading to Home; you'll get a text when they arrive.");

  const contact = await browser.newContext();
  const contactPage = await contact.newPage();
  await contactPage.goto(linkIn(sms.body, "/track/"));
  await expect(contactPage.getByText("Asha is heading to Home. You'll get a text when they arrive.")).toBeVisible();

  // Arrive: it takes two fixes there (one could be a GPS jump), so keep sending them like a
  // phone does. Then the countdown ends sharing by itself.
  let jitter = 0;
  await expect(async () => {
    await context.setGeolocation({ ...home, latitude: home.latitude + (++jitter % 2 ? 0.0002 : -0.0002) });
    await expect(page.getByText("You've reached Home")).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  await expect(page.getByText(/Sharing will stop and your contacts will be told in \d+ s\./)).toBeVisible();
  await expect(page.getByText("Glad you made it", { exact: true })).toBeVisible({ timeout: 45_000 });

  const arrived = await waitForMessage((m) => m.to === friend.phone && m.body.includes("has arrived"));
  expect(arrived.body).toBe("HerSpace: Asha has arrived at Home. No action needed.");
  await contactPage.reload();
  await expect(contactPage.getByText("Asha has arrived at Home")).toBeVisible();
  await contact.close();

  // Saved places are removed on logout (a shared phone shouldn't reveal where she lives).
  if (test.info().project.name === "phone") {
    await page.getByRole("button", { name: "More", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Log out" }).click();
  } else {
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Log out" }).click();
  }
  await expect.poll(() => page.evaluate(() => localStorage.getItem("herspace_places"))).toBeNull();

  assertNoErrors();
});

test("walk with me asks for a login first", async ({ page }) => {
  await page.goto("/walk");
  await expect(page.getByText("Log in and add an emergency contact to share your journey.")).toBeVisible();
});
