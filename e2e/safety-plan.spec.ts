import { test, expect } from "@playwright/test";

test("safety plan: saved as it's typed, only on the phone, and deletable; linked from the domestic violence guidance", async ({ page }) => {
  const sent: string[] = [];
  page.on("request", (r) => sent.push(`${r.url()} ${r.postData() ?? ""}`));

  await page.goto("/help#domestic-violence");
  await page.getByRole("link", { name: "Make a safety plan" }).click();
  await expect(page.getByRole("heading", { name: "My safety plan" })).toBeVisible();

  await page.getByRole("textbox", { name: "Warning signs" }).fill("When he drinks on Fridays");
  await page.getByRole("button", { name: "Add a person" }).click();
  await page.getByRole("textbox", { name: "Name" }).fill("Didi");
  await page.getByRole("textbox", { name: "Phone" }).fill("+91 98100 00000");
  await expect(page.getByRole("link", { name: "Call Didi" })).toHaveAttribute("href", "tel:+919810000000");
  await page.getByRole("checkbox", { name: "Some cash" }).click();
  await expect(page.getByText(/Saved on this phone at/)).toBeVisible();

  await page.reload();
  await expect(page.getByRole("textbox", { name: "Warning signs" })).toHaveValue("When he drinks on Fridays");
  await expect(page.getByRole("textbox", { name: "Name" })).toHaveValue("Didi");
  await expect(page.getByRole("checkbox", { name: "Some cash" })).toBeChecked();
  expect(sent.filter((r) => r.includes("drinks on Fridays") || r.includes("Didi"))).toEqual([]);

  await page.getByRole("button", { name: "Delete my plan" }).click();
  await expect(page.getByRole("textbox", { name: "Warning signs" })).toHaveValue("");
  expect(await page.evaluate(() => localStorage.getItem("herspace_safety_plan"))).toBeNull();
});
