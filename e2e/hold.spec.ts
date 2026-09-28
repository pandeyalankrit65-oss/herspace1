import { test, expect, type Page } from "@playwright/test";
import { readOutbox, signUp, addConfirmedContact } from "./helpers";

test.use({ permissions: ["geolocation"], geolocation: { latitude: 17.385, longitude: 78.4867 } });

async function holdButton(page: Page, ms: number) {
  const box = (await page.getByRole("button", { name: /EMERGENCY SOS/ }).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

test("in hold mode, letting go early cancels and a full hold sends at once", async ({ page, browser }) => {
  await signUp(page, "Nila");
  const contact = await addConfirmedContact(page, browser, "Mom");
  await page.goto("/sos");
  await page.getByRole("radio", { name: "Press and hold for 3 seconds" }).click();
  const button = page.getByRole("button", { name: /press and hold for 3 seconds/ });
  await expect(button).toContainText("Hold for 3 seconds");

  // A tap does nothing, and neither does a short hold.
  await button.click();
  await holdButton(page, 1200);
  await page.waitForTimeout(3500);
  await expect(page.getByText(/Alert sent|NOT sent|Sending alert/)).toHaveCount(0);
  expect(readOutbox().filter((m) => m.to === contact.phone && m.body.startsWith("HerSpace SOS"))).toEqual([]);

  // Holding the whole time sends straight away, with no second countdown.
  await holdButton(page, 3400);
  await expect(page.getByText("Alert sent to 1 contact")).toBeVisible({ timeout: 15_000 });

  // The choice is remembered.
  await page.goto("/sos");
  await expect(page.getByRole("radio", { name: "Press and hold for 3 seconds" })).toHaveAttribute("aria-checked", "true");
});

test("hold mode works from the keyboard", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard");
  await page.goto("/sos");
  await page.getByRole("radio", { name: "Press and hold for 3 seconds" }).click();
  await page.getByRole("button", { name: /EMERGENCY SOS/ }).focus();
  await page.keyboard.down("Space");
  await expect(page.getByText("Keep holding...")).toBeVisible();
  await page.keyboard.up("Space");
  await expect(page.getByText("Hold for 3 seconds", { exact: true })).toBeVisible();
});
