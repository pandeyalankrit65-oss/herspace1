import { test, expect } from "@playwright/test";

test("when police refused an FIR, the letter goes to the Superintendent of Police under Section 173(4)", async ({ page }) => {
  await page.goto("/complaint");
  await page.getByRole("radio", { name: "Police refused my FIR" }).click();
  await expect(page.getByText("Send it by registered post and keep the receipt.")).toBeVisible();
  await page.getByLabel("District (for the Superintendent of Police)").fill("Lucknow");
  await page.getByLabel("Police station that refused").fill("Hazratganj Police Station");
  await page.getByLabel("When you went there").fill("2026-10-05");
  await page.getByLabel("What happened").fill("A man followed me home from the bus stop and threatened me.");
  const letter = page.getByLabel("Your letter");
  await expect(letter).toHaveValue(/The Superintendent of Police,\nLucknow/);
  await expect(letter).toHaveValue(/Section 173\(4\) of the Bharatiya Nagarik Suraksha Sanhita, 2023/);
  await expect(letter).toHaveValue(/I went to Hazratganj Police Station to report the incident below, but the officer in charge did not register my FIR/);
});
