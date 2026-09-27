import { test, expect, type Page } from "@playwright/test";

// Synthetic motion events stand in for shaking the phone.
async function shake(page: Page, jolts: number, strength = 30) {
  for (let i = 0; i < jolts; i++) {
    await page.evaluate((x) => {
      window.dispatchEvent(new DeviceMotionEvent("devicemotion", { accelerationIncludingGravity: { x, y: 0, z: 9.8 } }));
    }, i % 2 ? -strength : strength);
    await page.waitForTimeout(200);
  }
}

test("shaking the phone starts the SOS countdown once the user turns it on", async ({ page, isMobile }) => {
  test.skip(!isMobile, "only offered on touch screens");
  await page.goto("/sos");
  const toggle = page.getByRole("switch", { name: "Shake to start SOS" });
  await expect(toggle).not.toBeChecked();

  // Off by default: shaking does nothing.
  await shake(page, 4);
  await expect(page.getByText("Sending alert...")).toHaveCount(0);

  await toggle.click();
  await expect(toggle).toBeChecked();
  // Walking-level movement and a single jolt don't trigger it.
  await shake(page, 4, 14);
  await shake(page, 1);
  await expect(page.getByText("Sending alert...")).toHaveCount(0);

  await shake(page, 3);
  await expect(page.getByText("Sending alert...")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();

  // The setting is remembered.
  await page.reload();
  await expect(page.getByRole("switch", { name: "Shake to start SOS" })).toBeChecked();
});

test("the shake option isn't shown on desktop", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop only");
  await page.goto("/sos");
  await expect(page.getByRole("button", { name: /EMERGENCY SOS/ })).toBeVisible();
  await expect(page.getByRole("switch", { name: "Shake to start SOS" })).toHaveCount(0);
});
