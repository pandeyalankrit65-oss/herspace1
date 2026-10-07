import { test, expect } from "@playwright/test";

test("the support chat offers SOS or a helpline as soon as a message suggests danger or self-harm", async ({ page }) => {
  await page.goto("/support");
  const input = page.getByPlaceholder(/Type your message/i);

  await input.fill("I'm a bit stressed about an exam");
  await input.press("Enter");
  await expect(page.getByRole("alert")).toHaveCount(0);

  await input.fill("A man has been following me since the bus stop");
  await input.press("Enter");
  const danger = page.getByRole("alert").filter({ hasText: "Are you in danger right now?" });
  await expect(danger).toBeVisible();
  await expect(danger.getByRole("link", { name: "Send SOS now" })).toHaveAttribute("href", "/sos?start=sos");
  await danger.getByRole("button", { name: "I'm okay, hide this" }).click();
  await expect(danger).toHaveCount(0);

  await input.fill("I don't want to live anymore");
  await input.press("Enter");
  const care = page.getByRole("alert").filter({ hasText: "you don't have to face this alone" });
  await expect(care.getByRole("link", { name: "Call Tele-MANAS 14416" })).toHaveAttribute("href", "tel:14416");

  // "Send SOS now" goes straight into the cancellable countdown.
  await page.goto("/support");
  await input.fill("bachao koi peecha kar raha hai");
  await input.press("Enter");
  await page.getByRole("link", { name: "Send SOS now" }).click();
  await expect(page.getByText("Sending alert...")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
});

test("the chat works with the app in Tamil", async ({ page }) => {
  const res = await page.request.post("/api/chat", {
    headers: { "X-Requested-With": "HerSpace" },
    data: { messages: [{ role: "user", content: "யாரோ என்னைப் பின்தொடர்கிறான்" }], lang: "ta" },
  });
  expect(res.status()).toBe(200);
  expect((await res.json()).message.content).toContain("SOS");
});
