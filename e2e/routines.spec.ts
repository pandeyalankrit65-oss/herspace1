import { test, expect } from "@playwright/test";
import { signUp } from "./helpers";

test("regular journeys: a reminder at the usual time fills in the journey; 'not today' hides it", async ({ page }) => {
  await signUp(page, "Asha");
  await page.goto("/walk");
  const manager = page.getByRole("region", { name: "Regular journeys" });
  await manager.getByLabel("Name").fill("Office to home");
  // Every day, at the current time, so it's due now.
  for (const day of ["Sat", "Sun"]) await manager.getByRole("button", { name: day, exact: true }).click();
  const now = await page.evaluate(() => new Date().toTimeString().slice(0, 5));
  await manager.getByLabel("Usual time").fill(now);
  await manager.getByRole("button", { name: "Add regular journey" }).click();
  await expect(manager).toContainText("Office to home");

  const reminder = page.getByRole("status").filter({ hasText: "Time for your usual journey" });
  await expect(reminder).toContainText(`Office to home, at ${now}`);
  await reminder.getByRole("link", { name: "Share this journey" }).click();
  await expect(page.getByLabel("Where are you going? (optional)")).toHaveValue("Office to home");

  // On the home page too, until "not today".
  await page.goto("/");
  const home = page.getByRole("status").filter({ hasText: "Time for your usual journey" });
  await expect(home).toBeVisible();
  await home.getByRole("button", { name: "Not today" }).click();
  await expect(home).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("Time for your usual journey")).toHaveCount(0);

  // Kept only on the phone.
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("herspace_routines") ?? "[]").length)).toBe(1);
  await page.goto("/walk");
  await page.getByRole("button", { name: "Remove Office to home" }).click();
  await expect(page.getByRole("region", { name: "Regular journeys" })).not.toContainText("Office to home");
});
