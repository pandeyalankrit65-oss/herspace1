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
