import { test, expect } from "@playwright/test";
import { addConfirmedContact, linkIn, signUp, waitForMessage } from "./helpers";

test.use({ permissions: ["geolocation"], geolocation: { latitude: 22.5726, longitude: 88.3639 } });

test("a cab ride is shared with the vehicle details and a check-in time", async ({ page, browser }) => {
  await signUp(page, "Rupa");
  const mom = await addConfirmedContact(page, browser, "Mom");

  await page.goto("/walk");
  await page.getByRole("tab", { name: "Cab or auto" }).click();
  const start = page.getByRole("button", { name: "Start sharing" });
  await expect(start).toBeDisabled(); // needs the vehicle number
  await page.getByLabel("Vehicle number").fill("WB 02 AK 1234");
  await page.getByRole("button", { name: "Auto", exact: true }).click();
  await page.getByLabel("App (optional)").fill("Rapido");
  await page.getByLabel("Going to (optional)").fill("Salt Lake");
  await page.getByRole("button", { name: "30 min", exact: true }).click();
  await start.click();

  await expect(page.getByText(/Tap "I've arrived" by/)).toBeVisible();
  const sms = await waitForMessage((m) => m.to === mom.phone && m.body.includes("is taking a ride"));
  expect(sms.body).toContain("Auto WB 02 AK 1234 (Rapido) to Salt Lake");
  expect(sms.body).toContain("If they don't check in by");

  const contact = await browser.newContext();
  const contactPage = await contact.newPage();
  await contactPage.goto(linkIn(sms.body, "/track/"));
  await expect(contactPage.getByRole("heading", { name: "Rupa is sharing their ride with you" })).toBeVisible();
  await expect(contactPage.getByText("Auto WB 02 AK 1234 (Rapido) to Salt Lake", { exact: false })).toBeVisible();
  await contact.close();

  await page.getByRole("button", { name: "I've arrived, stop sharing" }).click();
  await expect(page.getByText("Glad you made it", { exact: true })).toBeVisible();
  expect((await (await page.request.get("/api/check-ins/current")).json()).checkIn).toBeNull();
});

test("during a fake call, Keypad quietly sends a silent SOS", async ({ page, browser }) => {
  await signUp(page, "Sita");
  const sister = await addConfirmedContact(page, browser, "Sister");
  await page.goto("/sos#fake-call");
  await page.getByRole("button", { name: "Now", exact: true }).click();
  await page.getByRole("button", { name: /Schedule|Ring/ }).first().click();
  await page.getByRole("button", { name: /Accept|Answer/ }).click();
  await page.getByRole("button", { name: "Keypad" }).click();
  const sms = await waitForMessage((m) => m.to === sister.phone && m.body.startsWith("HerSpace SOS"), 20_000);
  expect(sms.body).toContain("DON'T call them or mention this alert");
  // Nothing on the call screen gives it away.
  await expect(page.getByRole("dialog")).not.toContainText(/SOS|alert/i);
  await page.getByRole("button", { name: /End/ }).click();
});
