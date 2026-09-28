import { test, expect } from "@playwright/test";
import { addConfirmedContact, signUp } from "./helpers";

test.use({ permissions: ["geolocation"], geolocation: { latitude: 19.076, longitude: 72.8777 } });

test("with no connection, the SOS page still opens and offers to text contacts", async ({ page, browser, context }) => {
  await signUp(page, "Zoya");
  await addConfirmedContact(page, browser, "Sister");

  // One online visit lets the service worker cache the app and the contacts.
  await page.goto("/sos");
  await expect(page.getByText(/1 confirmed emergency contact\./)).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.waitForTimeout(1_000); // let the worker finish caching loaded assets

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText(/You're offline/)).toBeVisible();
  await page.getByRole("button", { name: /EMERGENCY SOS/ }).click();
  await expect(page.getByText("Your alert was NOT sent automatically")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("link", { name: "Text Sister" })).toHaveAttribute("href", /q%3D19\.076%2C72\.8777|q=19\.076,72\.8777/);
  await expect(page.getByRole("link", { name: "Call 112" }).first()).toHaveAttribute("href", "tel:112");
  await context.setOffline(false);
});

// Waits until the service worker has stored every file of the build.
async function waitForPrecache(page: import("@playwright/test").Page) {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const { files } = await (await fetch("/precache-manifest.json")).json();
          const cache = await caches.open("herspace-v3");
          const stored = new Set((await cache.keys()).map((r) => new URL(r.url).pathname));
          return files.every((f: string) => stored.has(f));
        }),
      { timeout: 30_000 }
    )
    .toBe(true);
}

test("after one visit, every page opens offline and says what needs internet", async ({ page, context }) => {
  await signUp(page, "Farah");
  await page.goto("/map"); // remembers the map incidents
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await waitForPrecache(page);

  await context.setOffline(true);
  // Pages never opened before still work.
  await page.goto("/help");
  await expect(page.getByRole("heading", { name: "Help & your rights" })).toBeVisible();
  await expect(page.getByRole("link", { name: /181.*Women Helpline/ })).toHaveAttribute("href", "tel:181");
  await expect(page.getByText("You're offline · SOS still texts and calls")).toBeVisible();

  await page.goto("/timer");
  await expect(page.getByText(/A safety timer needs internet/)).toBeVisible();
  await page.goto("/walk");
  await expect(page.getByText(/Sharing your journey needs internet/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Start sharing" })).toBeDisabled();
  await page.goto("/support");
  await expect(page.getByText(/the chat can't reply/)).toBeVisible();
  await expect(page.getByRole("link", { name: /181/ }).first()).toHaveAttribute("href", "tel:181");

  await page.goto("/map");
  await expect(page.getByText(/You're offline\. Showing incidents saved on/)).toBeVisible();
  await context.setOffline(false);
});

test("a report written offline is kept on the phone and sent when back online", async ({ page, context }) => {
  await signUp(page, "Ishita");
  await page.goto("/report");
  await waitForPrecache(page);

  await context.setOffline(true);
  await page.reload();
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "Stalking" }).click();
  await page.getByLabel("Incident Description *").fill("Written with no signal on the train");
  await page.getByRole("button", { name: "Submit Report" }).click();
  await expect(page.getByText("Report saved on this phone", { exact: true })).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByText("1 report saved offline has been sent.", { exact: true })).toBeVisible({ timeout: 15_000 });
  await page.goto("/account");
  await expect(page.getByText("Written with no signal on the train")).toBeVisible();
});

test("offline, contacts show the saved copy instead of an empty list", async ({ page, browser, context }) => {
  await signUp(page, "Noor");
  await addConfirmedContact(page, browser, "Sister");
  await page.reload();
  await expect(page.getByText("Sister", { exact: true })).toBeVisible();
  await waitForPrecache(page);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText(/adding or changing contacts needs internet/)).toBeVisible();
  await expect(page.getByText("Sister", { exact: true })).toBeVisible();
  await context.setOffline(false);
});
