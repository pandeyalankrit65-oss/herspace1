import { test, expect } from "@playwright/test";
import { addConfirmedContact, signUp, uniquePhone, waitForMessage } from "./helpers";

test("a user verifies their own number with a texted code, and alerts then show it", async ({ page, browser }) => {
  await signUp(page, "Tara");
  const mom = await addConfirmedContact(page, browser, "Mom");
  const own = uniquePhone();

  await page.goto("/account");
  await page.getByLabel("Mobile number (with country code)").fill(own);
  await page.getByRole("button", { name: "Send code" }).click();

  const sms = await waitForMessage((m) => m.to === own && m.body.includes("verification code"));
  const code = /\b(\d{6})\b/.exec(sms.body)![1];

  // A wrong code is refused, the right one verifies.
  await page.getByLabel(/Enter the 6-digit code/).fill(code === "000000" ? "111111" : "000000");
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByRole("alert")).toContainText("That code isn't right.");
  await page.getByLabel(/Enter the 6-digit code/).fill(code);
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByText("Verified", { exact: true })).toBeVisible();
  await expect(page.getByText(own)).toBeVisible();

  await page.goto("/contacts");
  await page.getByRole("button", { name: "Send test alert" }).click();
  const alert = await waitForMessage((m) => m.to === mom.phone && m.body.includes("TEST alert"));
  expect(alert.body).toContain(`Tara (${own})`);
});

test("alert by missed call is off until she turns it on, and stays on", async ({ page }) => {
  // The card shows only when HerSpace's number takes incoming texts and calls, which needs a
  // public server address: stand in for that here. The call itself is tested on the server.
  await page.route("**/api/sms-alert", (route) => route.fulfill({ json: { number: "+15550001111" } }));
  await signUp(page, "Lata");
  const own = uniquePhone();
  await page.goto("/account");
  await expect(page.getByText("Verify your phone number above to use this.")).toBeVisible();
  await expect(page.getByLabel("Alert by missed call")).toHaveCount(0);

  await page.getByLabel("Mobile number (with country code)").fill(own);
  await page.getByRole("button", { name: "Send code" }).click();
  const sms = await waitForMessage((m) => m.to === own && m.body.includes("verification code"));
  await page.getByLabel(/Enter the 6-digit code/).fill(/\b(\d{6})\b/.exec(sms.body)![1]);
  await page.getByRole("button", { name: "Verify" }).click();

  const toggle = page.getByLabel("Alert by missed call");
  await expect(toggle).not.toBeChecked();
  await toggle.click();
  await expect(toggle).toBeChecked();
  await expect(page.getByText(`On: a call from ${own} to +15550001111 alerts your confirmed contacts.`, { exact: false })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Alert by missed call")).toBeChecked();
});
