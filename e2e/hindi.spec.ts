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

  // Marketing pages are translated; legal pages explain they're English-only.
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /महिलाओं को सशक्त बनाना/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /सुरक्षा टाइमर/ }).first()).toBeVisible();
  await page.goto("/privacy");
  await expect(page.getByText("यह पेज अभी सिर्फ़ अंग्रेज़ी में उपलब्ध है।", { exact: false })).toBeVisible();
  await expect(page.locator("article")).toHaveAttribute("lang", "en");
  await page.goto("/login");

  // And back to English.
  await page.getByRole("button", { name: "भाषा बदलें" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByLabel("Email")).toBeVisible();
});
