import { test, expect } from "@playwright/test";
import { failOnConsoleErrors } from "./helpers";

const PAGES: Array<[string, RegExp]> = [
  ["/", /Empowering/],
  ["/sos", /Emergency SOS/],
  ["/report", /Report an Incident/],
  ["/support", /AI Support Chat/],
  ["/map", /Safe Map/],
  ["/circles", /Safe Circles/],
  ["/corporate", /Corporate Connect/],
  ["/partners", /Expert help/],
  ["/wellbeing", /Take a moment/],
  ["/safety-plan", /My safety plan/],
  ["/about", /About/],
  ["/contacts", /Emergency Contacts/],
  ["/login", /Log in/],
  ["/signup", /Sign up/],
  ["/forgot-password", /Reset your password/],
  ["/privacy", /Privacy Policy/],
  ["/terms", /Terms of Use/],
  ["/help", /Help & your rights/],
  ["/complaint", /Write a complaint/],
  ["/track/not-a-real-link", /Link not available/],
  ["/confirm-contact/not-a-real-link", /Link not valid/],
  ["/no-such-page", /404|not found/i],
];

for (const [path, heading] of PAGES) {
  test(`${path} renders cleanly`, async ({ page }) => {
    const assertNoErrors = failOnConsoleErrors(page);
    await page.goto(path);
    // Visible text only: the collapsed phone menu contains hidden copies of page names.
    await expect(page.getByText(heading).locator("visible=true").first()).toBeVisible();

    // Nothing wider than the screen (catches horizontal scrolling on phones).
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, "horizontal overflow in px").toBeLessThanOrEqual(1);
    assertNoErrors();
  });
}
