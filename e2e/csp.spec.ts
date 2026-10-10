import { test, expect, type Page } from "@playwright/test";
import { signUp } from "./helpers";

// The web build carries a Content-Security-Policy. If it ever blocks something the app needs, a
// feature quietly breaks, so every page is opened with a listener for violations.
test.use({ permissions: ["geolocation"], geolocation: { latitude: 19.076, longitude: 72.8777 } });

const PUBLIC = ["/", "/sos", "/report", "/support", "/map", "/circles", "/corporate", "/partners", "/wellbeing", "/safety-plan", "/record", "/about", "/login", "/signup", "/help", "/complaint", "/timer", "/walk", "/privacy", "/terms"];
const SIGNED_IN = ["/contacts", "/account", "/record", "/evidence", "/circles", "/corporate", "/walk", "/map"];

async function watch(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { cspViolations: string[] }).cspViolations = [];
    document.addEventListener("securitypolicyviolation", (e) => {
      (window as unknown as { cspViolations: string[] }).cspViolations.push(`${e.violatedDirective} ${e.blockedURI} line ${e.lineNumber}`);
    });
  });
}

async function visit(page: Page, paths: string[]) {
  for (const path of paths) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const blocked = await page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations);
    expect(blocked, path).toEqual([]);
  }
}

test("the policy is in the page, and nothing the app needs is blocked", async ({ page }) => {
  await watch(page);
  await page.goto("/");
  const policy = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content");
  expect(policy).toContain("script-src 'self' 'sha256-");
  expect(policy).toContain("object-src 'none'");
  // The theme script before the app is allowed by its hash: it ran.
  expect(await page.evaluate(() => document.documentElement.style.colorScheme)).toMatch(/dark|light/);

  await visit(page, PUBLIC);
  await signUp(page, "Priya");
  await visit(page, SIGNED_IN);
});

test("an injected inline script is refused", async ({ page }) => {
  await page.goto("/");
  const ran = await page.evaluate(async () => {
    (window as unknown as { injected?: boolean }).injected = false;
    const s = document.createElement("script");
    s.textContent = "window.injected = true";
    document.body.appendChild(s);
    await new Promise((r) => setTimeout(r, 100));
    return (window as unknown as { injected?: boolean }).injected;
  });
  expect(ran).toBe(false);
});
