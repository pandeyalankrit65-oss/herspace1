import { test, expect, type Page } from "@playwright/test";
import { signUp, waitForMessage } from "./helpers";

// A location no other test uses.
test.use({ permissions: ["geolocation"], geolocation: { latitude: 23.0225, longitude: 72.5714 } });

async function report(page: Page, description: string) {
  await page.goto("/report");
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "Harassment" }).click();
  await page.getByLabel("Incident Description *").fill(description);
  await page.getByLabel(/Add my current location/).check();
  await page.getByRole("button", { name: "Submit Report" }).click();
}

test("verified reporting: confirmed email, copied reports held, confirmations, and pausing an account by code name", async ({ page, browser }, testInfo) => {
  // Signing up goes through an emailed link, so the address is confirmed from the start.
  const asha = await signUp(page, "Asha");
  await page.goto("/account");
  await expect(page.getByText(`${asha.email} is confirmed.`)).toBeVisible();

  const text = `Two men harass women at the ${testInfo.project.name} bus depot every evening ${Date.now()}`;
  await report(page, text);
  await expect(page.getByText("Thank you for your courage. Your report has been saved.").first()).toBeVisible();

  // The same text from a new throwaway account waits for a moderator.
  const fakeContext = await browser.newContext();
  const fake = await fakeContext.newPage();
  await signUp(fake, "Temp", `fake-${testInfo.project.name}-${Date.now()}@mailinator.com`);
  await report(fake, text);
  await expect(fake.getByText("A moderator will check it before it appears on the map").first()).toBeVisible();
  const fakeId = (await (await fake.request.get("/api/auth/me")).json()).user.id as number;

  // A moderator with a confirmed email backs up Asha's report: "I saw this too".
  const modContext = await browser.newContext();
  const mod = await modContext.newPage();
  await signUp(mod, "Moderator", `trust-mod-${testInfo.project.name}@example.com`);
  const ashaReport = (await (await page.request.get("/api/reports")).json()).reports.find((r: { description: string }) => r.description === text);
  const confirmed = await mod.request.post(`/api/reports/${ashaReport.id}/confirm`, { headers: { "X-Requested-With": "HerSpace" } });
  expect((await confirmed.json()).confirmations).toBe(1);
  const point = (await (await page.request.get("/api/reports/map")).json()).points.find((p: { id: number }) => p.id === ashaReport.id);
  expect(point).toMatchObject({ trust: "account", confirmations: 1 });

  // The held copy is in its own queue, with the reason.
  await mod.goto("/moderation");
  await mod.getByRole("tab", { name: "Held" }).click();
  const held = mod.getByRole("article").filter({ hasText: text });
  await expect(held).toContainText("the same text was reported in the last week");
  await expect(held).toContainText("From a HerSpace account");

  // The throwaway account is listed by code name only, and can be paused from the map.
  const accounts = (await (await mod.request.get("/api/moderation/accounts")).json()).accounts as Array<{ id: number; name: string }>;
  const codeName = accounts.find((a) => a.id === fakeId)!.name;
  const card = mod.getByRole("article").filter({ hasText: `Account ${codeName}` });
  await expect(card).toContainText("throwaway email address");
  await expect(card).not.toContainText("mailinator");
  await card.getByLabel("Reason, sent to them (needed to pause)").fill("Copying other people's reports.");
  await card.getByRole("button", { name: "Pause from the map" }).click();
  await expect(mod.getByText("Paused. They've been emailed the reason.").first()).toBeVisible();

  const notice = await waitForMessage((m) => m.channel === "email" && m.subject === "Your HerSpace Safe Map access is paused" && m.body.includes("Copying other people's reports."));
  expect(notice.body).toContain("SOS, your emergency contacts");
  await fake.goto("/report");
  await expect(fake.getByText("A moderator has paused your account from adding to the Safe Map.")).toBeVisible();

  await fakeContext.close();
  await modContext.close();
});
