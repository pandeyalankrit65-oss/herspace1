import { test, expect } from "@playwright/test";

test("switching to Hindi translates the SOS page and is remembered", async ({ page }) => {
  await page.goto("/sos");
  await expect(page.getByRole("button", { name: /EMERGENCY SOS/ })).toBeVisible();

  await page.getByRole("button", { name: "Change language" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
  await expect(page.getByRole("heading", { name: "आपातकालीन SOS" })).toBeVisible();
  await expect(page.getByRole("link", { name: "112 पर कॉल करें" })).toBeVisible();
  await expect(page.getByRole("button", { name: /आवाज़ से चालू करें/ })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "आपातकालीन SOS" })).toBeVisible();

  await page.goto("/login");
  await expect(page.getByLabel("ईमेल")).toBeVisible();

  // And back to English.
  await page.getByRole("button", { name: "भाषा बदलें" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByLabel("Email")).toBeVisible();
});
