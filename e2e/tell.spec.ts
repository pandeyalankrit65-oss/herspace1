import { test, expect } from "@playwright/test";

test("telling it in her own words fills in the report form, and nothing is sent until she submits", async ({ page }) => {
  const reports: string[] = [];
  page.on("request", (r) => r.method() === "POST" && /\/api\/reports$/.test(r.url()) && reports.push(r.url()));
  await page.goto("/report");
  const words = "A man on the 7 o'clock bus kept pressing against me and followed me off at the market stop";
  await page.getByRole("textbox", { name: "Tell it in your own words" }).fill(words);
  await page.getByRole("button", { name: "Make a draft" }).click();

  // No AI here: her words go into the description, and she chooses the type herself.
  await expect(page.getByRole("status").filter({ hasText: "Your words are in the description below" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Incident Description *" })).toHaveValue(words);
  await expect(page.getByRole("combobox", { name: "Incident Type *" })).toContainText("Select");
  expect(reports).toHaveLength(0);
});
