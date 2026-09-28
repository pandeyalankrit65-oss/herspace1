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

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /महिलाओं को सशक्त बनाना/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /सुरक्षा टाइमर/ }).first()).toBeVisible();
  await page.goto("/privacy");
  // Legal pages are translated, marked as such, and link to the binding English text.
  await expect(page.getByRole("heading", { name: "प्राइवेसी पॉलिसी" })).toBeVisible();
  await expect(page.getByText("अंग्रेज़ी संस्करण मान्य होगा", { exact: false })).toBeVisible();
  await page.getByRole("link", { name: "अंग्रेज़ी संस्करण पढ़ें" }).click();
  await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();
  await page.goto("/terms");
  await expect(page.getByRole("heading", { name: "उपयोग की शर्तें" })).toBeVisible();
  await expect(page.locator("article")).toHaveAttribute("lang", "hi");
  await page.goto("/login");

  // And back to English.
  await page.getByRole("button", { name: "भाषा बदलें" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByLabel("Email")).toBeVisible();
});
