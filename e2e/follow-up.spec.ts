import { test, expect } from "@playwright/test";
import { signUp } from "./helpers";

test("the day after a report, and a few days later, home asks how she's doing", async ({ page }, testInfo) => {
  // Thursday 8 October 2026, 9 pm.
  await page.clock.install({ time: new Date(2026, 9, 8, 21, 0) });
  await signUp(page, "Rani");
  await page.goto("/report");
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "Harassment" }).click();
  // Unique per project: the same text twice would be held for review as a copy.
  await page.getByLabel("Incident Description *").fill(`Shouted at near the gate (${testInfo.project.name})`);
  await page.getByRole("button", { name: "Submit Report" }).click();
  await expect(page.getByText("Report Submitted", { exact: true })).toBeVisible();

  // Nothing the same evening.
  await page.goto("/");
  const card = page.getByRole("region", { name: /Checking in after your report/ });
  await expect(page.getByRole("heading", { name: /Welcome|Hi|Rani/ }).first()).toBeVisible();
  await expect(card).toHaveCount(0);

  // Next morning: still shaken.
  await page.clock.setSystemTime(new Date(2026, 9, 9, 10, 5));
  await page.reload();
  await expect(card).toContainText("Checking in after your report on Thursday");
  await card.getByRole("button", { name: "About the same" }).click();
  await expect(card).toContainText("That's very common after something frightening");
  await expect(card.getByRole("link", { name: /Tele-MANAS/ })).toHaveAttribute("href", "tel:14416");
  await expect(card.getByRole("link", { name: "Talk to a counsellor" })).toHaveAttribute("href", "/partners");
  await page.reload();
  await expect(card).toHaveCount(0);

  // Three days after: better, and that's the last check-in.
  await page.clock.setSystemTime(new Date(2026, 9, 11, 10, 5));
  await page.reload();
  await card.getByRole("button", { name: "Better" }).click();
  await expect(card).toContainText("Glad to hear it");
  await page.clock.setSystemTime(new Date(2026, 9, 20, 10, 5));
  await page.reload();
  await expect(card).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("herspace_follow_ups"))).toBeNull();
});
