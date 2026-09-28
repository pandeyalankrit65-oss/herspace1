import { test, expect } from "@playwright/test";

const LANGS = [
  { menu: /தமிழ்/, code: "ta", sos: "அவசர SOS", hero: "பெண்களுக்கு வலிமை", legalNote: "ஆங்கிலத்தில் மட்டுமே" },
  { menu: /বাংলা/, code: "bn", sos: "জরুরি SOS", hero: "নারীর ক্ষমতায়ন", legalNote: "শুধু ইংরেজিতে" },
  { menu: /मराठी/, code: "mr", sos: "आपत्कालीन SOS", hero: "महिलांचे सक्षमीकरण", legalNote: "फक्त इंग्रजीत" },
];

for (const l of LANGS) {
  test(`the app works in ${l.code}, and says which pages are English only`, async ({ page }) => {
    await page.goto("/sos");
    await page.getByRole("button", { name: "Change language" }).click();
    const item = page.getByRole("menuitem", { name: l.menu });
    await expect(item).toContainText("beta");
    await item.click();
    await expect(page.locator("html")).toHaveAttribute("lang", l.code);
    await expect(page.getByRole("heading", { name: l.sos })).toBeVisible();

    await page.goto("/");
    await expect(page.getByRole("heading", { name: new RegExp(l.hero) })).toBeVisible();

    await page.goto("/privacy");
    await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();
    await expect(page.getByText(l.legalNote, { exact: false })).toBeVisible();
  });
}

test("longer translations don't overflow a phone screen", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone width");
  for (const l of LANGS) {
    await page.goto("/");
    await page.evaluate((code) => localStorage.setItem("herspace_lang", code), l.code);
    for (const path of ["/", "/sos", "/walk", "/map", "/help", "/report"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${l.code} ${path}`).toBeLessThanOrEqual(1);
    }
  }
});
