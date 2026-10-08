import { test, expect } from "@playwright/test";
import { addConfirmedContact, failOnConsoleErrors, signUp } from "./helpers";

// Varanasi: no other test uses these coordinates. The OSM stub puts City Care Hospital about
// 450 m from here, nearer than its police station and pharmacy.
const HERE = { latitude: 25.3176, longitude: 82.9739, accuracy: 10 };
const HOSPITAL = { latitude: 25.314, longitude: 82.972, accuracy: 10 };
test.use({ permissions: ["geolocation"], geolocation: HERE });

test("after an SOS, the phone says out loud which way to the nearest safe place, and when she's there", async ({ page, browser, context }) => {
  const assertNoErrors = failOnConsoleErrors(page);
  // A stand-in voice that remembers what it was asked to say.
  await page.addInitScript(() => {
    const said: string[] = [];
    (window as never as { __said: string[] }).__said = said;
    Object.defineProperty(window, "speechSynthesis", {
      value: {
        speak: (u: SpeechSynthesisUtterance) => {
          said.push(u.text);
          setTimeout(() => u.onend?.(new Event("end") as SpeechSynthesisEvent), 0);
        },
        cancel: () => {},
        getVoices: () => [],
      },
    });
  });
  const said = () => page.evaluate(() => (window as never as { __said: string[] }).__said);

  await signUp(page, "Asha");
  await addConfirmedContact(page, browser, "Riya");
  await page.goto("/sos");
  await page.getByRole("button", { name: /EMERGENCY SOS/ }).click();
  await expect(page.getByText("Sharing your live location")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Guide me" }).click();
  const status = page.getByRole("status").filter({ hasText: "City Care Hospital" });
  await expect(status).toContainText(/City Care Hospital is 450 metres south-west\. Walk there now, on busy, lit roads\. Riya can see where you are\./);
  await expect.poll(said).toContainEqual(expect.stringContaining("City Care Hospital is 450 metres"));
  await expect(page.getByRole("link", { name: "Walking directions" })).toHaveAttribute("href", /destination=25\.314,82\.972&travelmode=walking/);

  // At the hospital.
  await context.setGeolocation(HOSPITAL);
  await expect(page.getByRole("status").filter({ hasText: "You've arrived" })).toBeVisible({ timeout: 30_000 });
  await expect.poll(said).toContainEqual("You've arrived. Go inside and ask for help.");

  await page.getByRole("button", { name: "Stop guiding" }).click();
  await page.getByRole("button", { name: "I'm safe, stop sharing" }).click();
  assertNoErrors();
});
