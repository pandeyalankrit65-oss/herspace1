import { test, expect, type Page } from "@playwright/test";
import { signUp } from "./helpers";

test.use({ permissions: ["geolocation"], geolocation: { latitude: 22.5726, longitude: 88.3639 } });

// A real JPEG (drawn by the browser) with an EXIF block holding a fake GPS position spliced in.
async function photoWithExif(page: Page) {
  const dataUrl = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 48;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#c026d3";
    ctx.fillRect(0, 0, 64, 48);
    return c.toDataURL("image/jpeg");
  });
  const jpeg = Buffer.from(dataUrl.split(",")[1], "base64");
  const payload = Buffer.from("Exif\0\0GPSLatitude 22.5726 GPSLongitude 88.3639", "binary");
  const app1 = Buffer.concat([Buffer.from([0xff, 0xe1, 0, payload.length + 2]), payload]);
  return Buffer.concat([jpeg.subarray(0, 2), app1, jpeg.subarray(2)]);
}

async function submitReport(page: Page, description: string, { withLocation = false, photo }: { withLocation?: boolean; photo?: Buffer } = {}) {
  await page.goto("/report");
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "Harassment" }).click();
  await page.getByLabel("Incident Description *").fill(description);
  if (photo) {
    await page.getByLabel("Photos (optional)").setInputFiles({ name: "evidence.jpg", mimeType: "image/jpeg", buffer: photo });
    await expect(page.getByRole("img", { name: "Photo 1" })).toBeVisible();
  }
  if (withLocation) await page.getByLabel(/Add my current location/).check();
  await page.getByRole("button", { name: "Submit Report" }).click();
  await expect(page.getByText("Report Submitted", { exact: true })).toBeVisible();
}

test("photos are attached to a report without their location data", async ({ page }) => {
  await signUp(page, "Ria");
  const original = await photoWithExif(page);
  expect(original.includes(Buffer.from("GPSLatitude"))).toBe(true);

  await submitReport(page, "Photo of the car that followed me", { photo: original });
  await expect(page.getByRole("img", { name: "Photo 1" })).toHaveCount(0); // form cleared

  await page.goto("/account");
  await expect(page.getByText("Photo of the car that followed me")).toBeVisible();
  await expect(page.getByRole("img", { name: "Photo 1" })).toBeVisible();

  const { reports } = await (await page.request.get("/api/reports")).json();
  const report = reports.find((r: { description: string }) => r.description === "Photo of the car that followed me");
  expect(report.photos).toHaveLength(1);
  const stored = await (await page.request.get(`/api/reports/${report.id}/photos/${report.photos[0]}`)).body();
  expect(stored.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
  expect(stored.includes(Buffer.from("GPSLatitude"))).toBe(false);
  expect(stored.includes(Buffer.from("Exif"))).toBe(false);
});

test("a moderator reviews a flagged map point and removes it", async ({ page, browser }, testInfo) => {
  const description = `Fake report ${Date.now()}`;
  await signUp(page, "Tara");
  await submitReport(page, description, { withLocation: true, photo: await photoWithExif(page) });

  // Someone flags it from the map.
  const points = (await (await page.request.get("/api/reports/map")).json()).points as Array<{ id: number; lat: number }>;
  const point = points.find((p) => p.lat === 22.57)!;
  expect(point).toBeTruthy();
  await page.request.post(`/api/reports/${point.id}/flag`, { headers: { "X-Requested-With": "HerSpace" } });

  // A regular user can't open the moderation page.
  await page.goto("/moderation");
  await expect(page.getByText("Only HerSpace moderators can see this page.")).toBeVisible();

  const modContext = await browser.newContext();
  const mod = await modContext.newPage();
  await signUp(mod, "Moderator", `moderator-${testInfo.project.name}@example.com`);
  await mod.goto("/moderation");
  const card = mod.getByRole("article").filter({ hasText: description });
  await expect(card).toContainText("1 flag");
  await expect(card).toContainText("On the map");
  await expect(card.getByRole("img", { name: "Photo 1" })).toBeVisible();
  await expect(mod.getByText("Tara")).toHaveCount(0); // never who reported it

  await card.getByRole("button", { name: "Remove from the map" }).click();
  await expect(mod.getByText("Removed from the map", { exact: true })).toBeVisible();
  await expect(mod.getByText(description)).toHaveCount(0);
  const after = (await (await page.request.get("/api/reports/map")).json()).points as Array<{ id: number }>;
  expect(after.some((p) => p.id === point.id)).toBe(false);

  await mod.getByRole("tab", { name: "Removed" }).click();
  await expect(mod.getByText(description)).toBeVisible();
  await modContext.close();
});
