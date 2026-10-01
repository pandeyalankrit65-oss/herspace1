import { test, expect } from "@playwright/test";

const LANGS = [
  {
    menu: /தமிழ்/, code: "ta", sos: "அவசர SOS", hero: "பெண்களுக்கு வலிமை",
    privacy: "தனியுரிமைக் கொள்கை", terms: "பயன்பாட்டு விதிமுறைகள்", readEnglish: "ஆங்கிலப் பதிப்பைப் படி", readBack: "தமிழில் படிக்க",
    police: "காவல்துறையிடம் உங்கள் உரிமைகள்", womenHelpline: "பெண்கள் உதவி எண் (24x7)",
  },
  {
    menu: /বাংলা/, code: "bn", sos: "জরুরি SOS", hero: "নারীর ক্ষমতায়ন",
    privacy: "গোপনীয়তা নীতি", terms: "ব্যবহারের শর্তাবলি", readEnglish: "ইংরেজি সংস্করণ পড়ুন", readBack: "বাংলায় পড়ুন",
    police: "পুলিশের কাছে আপনার অধিকার", womenHelpline: "মহিলা হেল্পলাইন (24x7)",
  },
  {
    menu: /मराठी/, code: "mr", sos: "आपत्कालीन SOS", hero: "महिलांचे सक्षमीकरण",
    privacy: "गोपनीयता धोरण", terms: "वापराच्या अटी", readEnglish: "इंग्रजी आवृत्ती वाचा", readBack: "मराठीत वाचा",
    police: "पोलिसांकडे तुमचे हक्क", womenHelpline: "महिला हेल्पलाइन (24x7)",
  },
];

for (const l of LANGS) {
  test(`the app works in ${l.code}, including the privacy policy and terms`, async ({ page }) => {
    await page.goto("/sos");
    await page.getByRole("button", { name: "Change language" }).click();
    const item = page.getByRole("menuitem", { name: l.menu });
    await expect(item).toContainText("beta");
    await item.click();
    await expect(page.locator("html")).toHaveAttribute("lang", l.code);
    await expect(page.getByRole("heading", { name: l.sos })).toBeVisible();

    // Coming back: the saved language is loaded before the first paint, so English never shows.
    await page.addInitScript(() => {
      new MutationObserver(() => {
        if (document.body?.textContent?.includes("Emergency SOS")) (window as unknown as { sawEnglish: boolean }).sawEnglish = true;
      }).observe(document, { childList: true, subtree: true, characterData: true });
    });
    await page.goto("/sos");
    await expect(page.getByRole("heading", { name: l.sos })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { sawEnglish?: boolean }).sawEnglish ?? false)).toBe(false);

    await page.goto("/");
    await expect(page.getByRole("heading", { name: new RegExp(l.hero) })).toBeVisible();

    // Legal pages are translated, say the English version is binding, and link to it and back.
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { level: 1, name: l.privacy })).toBeVisible();
    await page.getByRole("link", { name: l.readEnglish }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeVisible();
    await page.getByRole("link", { name: l.readBack }).click();
    await expect(page.getByRole("heading", { level: 1, name: l.privacy })).toBeVisible();
    await page.goto("/terms");
    await expect(page.getByRole("heading", { level: 1, name: l.terms })).toBeVisible();

    // The help guide too, and a link to one of its sections opens it.
    await page.goto("/help#police");
    await expect(page.getByText(l.womenHelpline)).toBeVisible();
    await expect(page.getByRole("button", { name: l.police })).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText("Zero FIR", { exact: false })).toHaveCount(0); // no English left
  });
}

test("longer translations don't overflow a phone screen", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone width");
  for (const l of LANGS) {
    await page.goto("/");
    await page.evaluate((code) => localStorage.setItem("herspace_lang", code), l.code);
    for (const path of ["/", "/sos", "/walk", "/map", "/help", "/report", "/privacy", "/terms"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${l.code} ${path}`).toBeLessThanOrEqual(1);
    }
  }
});
