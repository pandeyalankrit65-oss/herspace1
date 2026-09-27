import { test, expect } from "@playwright/test";
import { signUp } from "./helpers";

// A location no other test uses, so the marker is unambiguous.
test.use({ permissions: ["geolocation"], geolocation: { latitude: 26.9124, longitude: 75.7873 } });

test("a report with location appears on the map, coarsened, and can be flagged", async ({ page }) => {
  await signUp(page, "Kavya");
  await page.goto("/report");
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "Stalking" }).click();
  await page.getByLabel("Incident Description *").fill("Followed from the bus stop");
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
  await expect(page.getByText("Followed from the bus stop")).toBeVisible();
});
