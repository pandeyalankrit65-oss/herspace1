import { test, expect } from "@playwright/test";

test("well-being: guided breathing, grounding, and a mood journal that never leaves the phone", async ({ page }) => {
  const sent: string[] = [];
  page.on("request", (r) => sent.push(`${r.url()} ${r.postData() ?? ""}`));
  await page.goto("/wellbeing");

  // Breathing: the cue changes after the first 4 seconds.
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByText("Breathe in", { exact: true })).toBeVisible();
  await expect(page.getByText("Hold", { exact: true })).toBeVisible({ timeout: 6000 });
  await page.getByRole("button", { name: "Stop" }).click();
  await expect(page.getByText("Ready when you are")).toBeVisible();

  // Grounding, step by step.
  await page.getByRole("button", { name: "Begin" }).click();
  await expect(page.getByText("Name 5 things you can see")).toBeVisible();
  for (let i = 0; i < 5; i++) await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Well done. Take one more slow breath.")).toBeVisible();

  // A very low day offers people to talk to.
  const note = `Couldn't sleep after what happened ${Date.now()}`;
  // The saved note in the journal list (it is also still in the text box).
  const saved = page.getByRole("listitem").filter({ hasText: note });
  await page.getByRole("radio", { name: "Very low" }).click();
  await page.getByLabel("Anything on your mind? (optional)").fill(note);
  await page.getByRole("button", { name: "Save check-in" }).click();
  await expect(page.getByText("Saved on this phone").first()).toBeVisible();
  const support = page.getByRole("region", { name: "You don't have to manage this alone" });
  await expect(support, "shown once, not twice").toHaveCount(1);
  await expect(support.getByRole("link", { name: /Tele-MANAS 14416/ })).toHaveAttribute("href", "tel:14416");
  await expect(saved).toBeVisible();

  // Still there after a reload; never sent anywhere.
  await page.reload();
  await expect(saved).toBeVisible();
  await expect(page.getByRole("button", { name: "Update today's check-in" })).toBeVisible();
  expect(sent.filter((r) => r.includes("sleep after what happened"))).toEqual([]);

  await page.getByRole("button", { name: "Delete all check-ins" }).click();
  await expect(saved).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("herspace_mood_journal"))).toBeNull();
});
