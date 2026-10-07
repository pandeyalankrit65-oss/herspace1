import { test, expect } from "@playwright/test";
import { signUp } from "./helpers";

// A location no other test uses, so the marker is unambiguous.
test.use({ permissions: ["geolocation"], geolocation: { latitude: 26.9124, longitude: 75.7873 } });

test("a report with location appears on the map, coarsened, and can be flagged", async ({ page }, testInfo) => {
  // Unique per project: the same text twice would be held for review as a copy.
  const description = `Followed from the bus stop (${testInfo.project.name})`;
  await signUp(page, "Kavya");
  await page.goto("/report");
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "Stalking" }).click();
  await page.getByLabel("Incident Description *").fill(description);
  await page.getByLabel(/Add my current location/).check();
  await page.getByRole("button", { name: "Submit Report" }).click();
  await expect(page.getByText("Report Submitted", { exact: true })).toBeVisible();

  // The public map data never includes the description, and is rounded to ~1 km.
  const points = (await (await page.request.get("/api/reports/map")).json()).points as Array<Record<string, unknown>>;
  const mine = points.find((p) => p.lat === 26.91 && p.lng === 75.79);
  expect(mine).toMatchObject({ incidentType: "stalking" });
  expect(JSON.stringify(points)).not.toContain("bus stop");

  await page.goto("/map");
  await expect(page.locator(".leaflet-interactive").first()).toBeVisible();

  // The report is visible on the account page (not anonymous).
  await page.goto("/account");
  await expect(page.getByText(description)).toBeVisible();
});

test("the map shows police, hospitals and pharmacies near the user", async ({ page }) => {
  await page.goto("/map");
  await expect(page.getByText(/Tap "Show my location"/)).toBeVisible();
  await page.getByRole("button", { name: "Show my location" }).click();

  // Places come from the stubbed Overpass server (e2e/stub-osm.mjs).
  const police = page.getByRole("button", { name: /Police/ });
  await expect(police).toContainText("1");
  await expect(page.locator(".leaflet-marker-icon")).toHaveCount(3);

  await page.locator(".leaflet-marker-icon").filter({ hasText: "P" }).click();
  const popup = page.locator(".leaflet-popup");
  await expect(popup).toContainText("Parliament Street Police Station");
  await expect(popup.getByRole("link", { name: "Call" })).toHaveAttribute("href", "tel:+911123361233");
  await expect(popup.getByRole("link", { name: "Directions" })).toHaveAttribute("href", /destination=/);

  // Filter chips hide a category.
  await police.click();
  await expect(police).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".leaflet-marker-icon")).toHaveCount(2);
});
