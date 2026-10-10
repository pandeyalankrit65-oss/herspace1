import { test, expect } from "@playwright/test";
import { addConfirmedContact, signUp } from "./helpers";

test("a daily check-in: turned on from the timer page, a reminder on home near the deadline, and \"I'm fine\"", async ({ page, browser }) => {
  await page.clock.install();
  await signUp(page, "Savitri");
  await addConfirmedContact(page, browser, "Son");

  await page.goto("/timer");
  const card = page.locator("#daily-check-in");
  // An hour before now: tomorrow's deadline is then about a day away, whatever time the test runs.
  const deadline = new Date(Date.now() - 60 * 60 * 1000).toTimeString().slice(0, 5);
  await card.getByLabel("Say I'm fine by").fill(deadline);
  await card.getByRole("button", { name: "Turn on" }).click();
  await expect(card).toContainText(`On: say you're fine by ${deadline} each day.`);
  const next = await page.evaluate(() => fetch("/api/daily-checkin").then((r) => r.json()).then((d) => d.nextDueAt as string));

  // Not on home yet (it's a day away); two hours before the deadline it is.
  await page.goto("/");
  const reminder = page.getByRole("region", { name: "Daily check-in" });
  await expect(page.getByRole("button", { name: "I'm fine" })).toHaveCount(0);
  await page.clock.setSystemTime(new Date(new Date(next).getTime() - 2 * 60 * 60 * 1000));
  await page.reload();
  await expect(reminder).toContainText("Tap before");
  await reminder.getByRole("button", { name: "I'm fine" }).click();
  await expect(reminder).toHaveCount(0);

  // Away for a few days, then off.
  await page.goto("/timer");
  await card.getByRole("button", { name: "Away for 3 days" }).click();
  await expect(page.getByText("Paused: no check-ins for 3 days.").first()).toBeVisible();
  await card.getByRole("button", { name: "Turn off" }).click();
  await expect(card.getByRole("button", { name: "Turn on" })).toBeVisible();
});
