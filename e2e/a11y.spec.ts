import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { signUp } from "./helpers";

// Automated accessibility checks (WCAG 2.1 A and AA rules that axe can test) on every page,
// in light and dark mode. Automated checks catch only part of the problems; they don't
// replace testing with a screen reader.
// Reduced motion shows scroll-reveal sections straight away, so axe checks all of them.
test.use({ reducedMotion: "reduce" });

const PUBLIC_PAGES = ["/", "/sos", "/report", "/support", "/map", "/circles", "/corporate", "/partners", "/wellbeing", "/safety-plan", "/about", "/login", "/signup", "/forgot-password", "/timer", "/walk", "/privacy", "/terms", "/help", "/complaint", "/track/not-a-real-token", "/no-such-page"];
const SIGNED_IN_PAGES = ["/", "/sos", "/contacts", "/account", "/timer", "/walk", "/moderation", "/circles", "/corporate", "/partners/join"];

async function audit(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  // Let entrance animations finish so colours are measured at rest.
  await page.waitForTimeout(400);
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    // Map tiles are third-party images from OpenStreetMap.
    .exclude(".leaflet-tile-pane")
    .analyze();
  return violations.map((v) => ({
    page: path,
    rule: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.slice(0, 3).map((n) => `${n.target.join(" ")} :: ${n.failureSummary?.split("\n")[1]?.trim() ?? ""}`),
  }));
}

for (const theme of ["light", "dark"] as const) {
  test.describe(`${theme} mode`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem("herspace_theme", t), theme);
    });

    test("public pages have no detectable accessibility violations", async ({ page }) => {
      const found = [];
      for (const path of PUBLIC_PAGES) found.push(...(await audit(page, path)));
      expect(found).toEqual([]);
    });

    test("signed-in pages have no detectable accessibility violations", async ({ page }) => {
      await signUp(page, "Asha");
      // A report, so the evidence pack and the complaint letter have something to show.
      const report = await page.request.post("/api/reports", {
        headers: { "X-Requested-With": "HerSpace" },
        data: { incidentType: "harassment", description: "Followed from the bus stop.", location: "Sector 18" },
      });
      expect(report.ok()).toBe(true);
      const { id } = await report.json();
      const found = [];
      for (const path of [...SIGNED_IN_PAGES, `/evidence/${id}`, `/complaint?report=${id}`]) found.push(...(await audit(page, path)));
      expect(found).toEqual([]);
    });
  });
}
