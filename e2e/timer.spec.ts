import { test, expect } from "@playwright/test";
import { addConfirmedContact, signUp, waitForMessage } from "./helpers";

test.use({ permissions: ["geolocation"], geolocation: { latitude: 12.9716, longitude: 77.5946 } });

test("start, extend and check in on a safety timer", async ({ page, browser }) => {
  await signUp(page, "Tara");
  await addConfirmedContact(page, browser, "Mom");
  await page.goto("/timer");
  await page.getByRole("button", { name: "15 min" }).click();
  await page.getByLabel("What are you doing? (optional)").fill("Walking home from the metro");
  await page.getByRole("button", { name: "Start timer" }).click();

  await expect(page.getByText("Time left")).toBeVisible();
  await expect(page.getByText('"Walking home from the metro"')).toBeVisible();
  const endsAt = page.getByText(/^Ends at /);
  const before = await endsAt.textContent();
  await page.getByRole("button", { name: "+15 min" }).click();
  await expect(endsAt).not.toHaveText(before!);

  // Survives a reload (the timer lives on the server).
  await page.reload();
  await expect(page.getByText("Time left")).toBeVisible();

  await page.getByRole("button", { name: "I'm safe" }).click();
  await expect(page.getByText("Glad you're safe", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start timer" })).toBeVisible();
});

test("when the timer runs out, the server alerts contacts and the user can resolve it", async ({ page, browser }) => {
  test.skip(test.info().project.name !== "desktop", "takes a minute; once is enough");
  test.setTimeout(150_000);
  await signUp(page, "Uma");
  const mom = await addConfirmedContact(page, browser, "Mom");

  // Shortest timer through the API (the page offers 15 minutes and up).
  const res = await page.request.post("/api/check-ins", {
    data: { minutes: 1, note: "Test walk", coords: { lat: 12.9716, lng: 77.5946 } },
    headers: { "X-Requested-With": "HerSpace" },
  });
  expect(res.status()).toBe(201);
  await page.goto("/timer");
  await expect(page.getByText("Time left")).toBeVisible();

  const alert = await waitForMessage((m) => m.to === mom.phone && m.body.startsWith("HerSpace safety alert"), 90_000);
  expect(alert.body).toContain('("Test walk")');
  expect(alert.body).toContain("maps.google.com/?q=12.9716,77.5946");
  expect(alert.body).toContain("/track/");

  await expect(page.getByText("Your contacts have been alerted")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "I'm safe, stop the alert" }).click();
  await expect(page.getByText(/Your live location link has stopped/)).toBeVisible();
});
