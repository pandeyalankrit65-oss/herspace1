import { test, expect } from "@playwright/test";

// A place no other test uses, different for each project so their reports don't mix.
const spot = (project: string) => ({ lat: project === "phone" ? 26.95 : 26.85, lng: 80.95 });

test.beforeEach(async ({ context }, testInfo) => {
  const { lat, lng } = spot(testInfo.project.name);
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: lat, longitude: lng });
});

test("heatmap and reports near you: weighted squares, and an honest estimate", async ({ page }, testInfo) => {
  const at = spot(testInfo.project.name);

  // Before any reports here: nothing nearby, and that is not called safe.
  await page.goto("/map");
  await expect(page.getByText(/to see what has been reported around you/)).toBeVisible();
  await page.getByRole("button", { name: "Show my location" }).click();
  await expect(page.getByText("No reports near you in this period.")).toBeVisible();
  await expect(page.getByText(/so few or no reports doesn't mean an area is safe/)).toBeVisible();

  // Three recent anonymous reports at this spot.
  for (const what of ["followed", "stared at and followed", "shouted at"]) {
    const res = await page.request.post("/api/reports", {
      headers: { "X-Requested-With": "HerSpace" },
      data: { incidentType: "harassment", description: `Was ${what} near the market (${testInfo.project.name})`, coords: at, anonymous: true },
    });
    expect(res.ok()).toBe(true);
  }

  await page.reload();
  await page.getByRole("button", { name: "Show my location" }).click();
  await expect(page.getByText(/^3 reports nearby\. Weighed for how recent, serious and confirmed they are/)).toBeVisible();
  await expect(page.getByText("0 from verified reporters or confirmed", { exact: false })).toBeVisible();

  // The heatmap draws a square instead of individual points.
  const shapes = page.locator("path.leaflet-interactive");
  const pointsCount = await shapes.count();
  await page.getByRole("button", { name: "Heatmap" }).click();
  await expect(page.getByText(/Each square is about 1 km/)).toBeVisible();
  await expect(shapes).not.toHaveCount(pointsCount);
  await expect(shapes.first()).toBeVisible();

  // A shorter period still includes these new reports.
  await page.getByRole("combobox", { name: "Reports from" }).selectOption("3m");
  await expect(page.getByText(/^3 reports nearby/)).toBeVisible();
});
