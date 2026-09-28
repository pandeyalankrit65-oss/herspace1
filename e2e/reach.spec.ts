import { test, expect } from "@playwright/test";
import { signUp } from "./helpers";

test.use({ permissions: ["geolocation"], geolocation: { latitude: 13.0827, longitude: 80.2707 } });

test("when alerts can't be sent automatically, one button texts every contact", async ({ page }) => {
  await signUp(page, "Anjali");
  for (const [name, phone] of [["Friend", "+91 90000 22222"], ["Aunt", "+91 90000 33333"]]) {
    await page.getByRole("button", { name: "Add Contact" }).click();
    await page.getByLabel("Name").fill(name);
    await page.getByLabel("Phone (with country code)").fill(phone);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await page.getByRole("button", { name: "Done" }).click();
  }
  await page.goto("/sos");
  await page.getByRole("button", { name: /EMERGENCY SOS/ }).click();
  await expect(page.getByText("Your alert was NOT sent automatically")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("link", { name: "Text all 2 contacts at once" })).toHaveAttribute(
    "href",
    /^sms:(\+919000022222,\+919000033333|\+919000033333,\+919000022222)\?&body=HerSpace%20SOS/
  );
});

test("the SOS page can be read aloud, and points to help for people who can't speak", async ({ page }) => {
  await page.goto("/sos");
  const read = page.getByRole("button", { name: "Read aloud" });
  await read.click();
  await expect(page.getByRole("button", { name: "Stop reading" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Stop reading" }).click();
  await page.getByRole("link", { name: "Can't speak or hear?" }).click();
  await expect(page).toHaveURL(/\/help#cant-speak$/);
  await expect(page.getByText("In many states you can send an SMS to 112", { exact: false })).toBeVisible();
});
