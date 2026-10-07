import { test, expect } from "@playwright/test";
import { signUp } from "./helpers";

// The OSM stub's search returns "Underpass Market" (22.57) and "Underpass Market North" (22.62).
const setup = (project: string) =>
  project === "phone"
    ? { start: { lat: 22.69, lng: 88.36 }, middle: { lat: 22.65, lng: 88.36 }, place: "Underpass Market North" }
    : { start: { lat: 22.5, lng: 88.36 }, middle: { lat: 22.54, lng: 88.36 }, place: "Underpass Market," };

test("check the way: search a destination, see reports along a straight line and help there", async ({ page, context }, testInfo) => {
  const s = setup(testInfo.project.name);
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: s.start.lat, longitude: s.start.lng, accuracy: 20 });

  // Three recent assaults partway there.
  for (const i of [1, 2, 3]) {
    const res = await page.request.post("/api/reports", {
      headers: { "X-Requested-With": "HerSpace" },
      data: { incidentType: "assault", description: `Grabbed on the bridge road, report ${i} (${testInfo.project.name})`, coords: s.middle, time: "22:00", anonymous: true },
    });
    expect(res.ok()).toBe(true);
  }

  await signUp(page, "Asha");
  await page.goto("/walk");
  await page.getByRole("textbox", { name: "Search for a place" }).fill("Underpass Market");
  await page.getByRole("button", { name: "Search for a place" }).click();
  await page.getByRole("button", { name: new RegExp(`^${s.place}`) }).click();

  const check = page.getByRole("region", { name: /Check the way to Underpass Market/ });
  await check.getByRole("button", { name: "Check the way" }).click();
  await expect(check).toContainText("About 7.8 km in a straight line.");
  await expect(check).toContainText("area with recent reports along the way");
  await expect(check).toContainText(/% of the way: Several reports \(3\)/);
  await expect(check).toContainText("Nearest police there: Parliament Street Police Station");
  await expect(check).toContainText("Consider a ride instead of walking");
  await expect(check).toContainText("This checks a straight line between here and there, not your actual route");
});
