import fs from "fs";
import { test, expect } from "@playwright/test";
import { addConfirmedContact, failOnConsoleErrors, linkIn, signUp, waitForMessage } from "./helpers";

test.use({ permissions: ["geolocation"], geolocation: { latitude: 28.6139, longitude: 77.209, accuracy: 20 } });

test("the evidence pack puts a report, its photo, the SOS around it and a draft complaint in one printable document", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const assertNoErrors = failOnConsoleErrors(page);
  await signUp(page, "Asha");
  const mom = await addConfirmedContact(page, browser, "Mom");

  // An SOS, answered by the contact.
  await page.goto("/sos");
  await page.getByRole("button", { name: /EMERGENCY SOS/ }).click();
  await expect(page.getByText("Sharing your live location")).toBeVisible({ timeout: 15_000 });
  const sos = await waitForMessage((m) => m.to === mom.phone && m.body.startsWith("HerSpace SOS"));
  const contact = await browser.newContext();
  const contactPage = await contact.newPage();
  await contactPage.goto(linkIn(sos.body, "/track/"));
  await contactPage.getByRole("button", { name: "I'm on my way" }).click();
  await expect(contactPage.getByText(/can see that you're on your way/)).toBeVisible();
  await contact.close();
  await page.getByRole("button", { name: "I'm safe, stop sharing" }).click();

  // A report with a photo.
  const photo = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 48;
    c.getContext("2d")!.fillRect(0, 0, 64, 48);
    return c.toDataURL("image/jpeg").split(",")[1];
  });
  await page.goto("/report");
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "Stalking" }).click();
  await page.getByLabel("Incident Description *").fill("A man followed me from the metro to my building.");
  await page.getByLabel("Photos (optional)").setInputFiles({ name: "car.jpg", mimeType: "image/jpeg", buffer: Buffer.from(photo, "base64") });
  await expect(page.getByRole("img", { name: "Photo 1" })).toBeVisible();
  await page.getByRole("button", { name: "Submit Report" }).click();
  await expect(page.getByText("Report Submitted", { exact: true })).toBeVisible();

  await page.goto("/account");
  await page.getByRole("link", { name: "Evidence pack (PDF)" }).click();
  await expect(page).toHaveURL(/\/evidence\/\d+$/);

  const doc = page.locator(".evidence-doc");
  await expect(doc.getByRole("heading", { name: "Incident evidence" })).toBeVisible();
  await expect(doc.getByText("Prepared by Asha on")).toBeVisible();
  await expect(doc.getByText("Stalking")).toBeVisible();
  await expect(doc.getByText("A man followed me from the metro to my building.").first()).toBeVisible();
  await expect(doc.getByRole("img", { name: "Photo 1" })).toBeVisible();
  await expect(doc.getByText(/^SOS alert at /)).toHaveCount(1);
  await expect(doc.getByText("Location: 28.61390, 77.20900 (accurate to about 20 m)")).toBeVisible();
  await expect(doc.getByText(/^Mom: SMS sent/)).toBeVisible();
  await expect(doc.getByText(/^Mom replied "I'm on my way" at /)).toBeVisible();
  await expect(doc.getByText(/To,\s+The Station House Officer/)).toBeVisible();
  await expect(doc.getByText("Attached: 1 photo", { exact: false })).toBeVisible();

  // In print, only the document shows: no navbar, buttons or bottom navigation.
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("button", { name: "Save as PDF / Print" })).toBeHidden();
  await expect(page.getByRole("banner")).toBeHidden();
  await expect(doc).toBeVisible();
  if (test.info().project.name === "desktop") {
    const pdf = await page.pdf({ format: "A4" });
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(20_000);
    fs.writeFileSync(test.info().outputPath("evidence.pdf"), pdf); // kept with the test results, to look at
  }

  assertNoErrors();
});

test("someone else's report has no evidence pack", async ({ page }) => {
  await signUp(page, "Bina");
  await page.goto("/evidence/1");
  await expect(page.getByText("This report couldn't be found.", { exact: false })).toBeVisible();
});
