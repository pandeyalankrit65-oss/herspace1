import { test, expect } from "@playwright/test";
import { signUp } from "./helpers";

test("help lists tap-to-call helplines and opens a section from a link", async ({ page }) => {
  await page.goto("/help#domestic-violence");
  await expect(page.getByRole("link", { name: /181.*Women Helpline/ })).toHaveAttribute("href", "tel:181");
  await expect(page.getByRole("link", { name: /1930.*Cybercrime/ })).toHaveAttribute("href", "tel:1930");
  // Deep link opens that section.
  await expect(page.getByText("You have the right to live in the shared home", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Harassment at work (POSH)" }).click();
  await expect(page.getByRole("link", { name: /SHe-Box portal/ })).toHaveAttribute("href", "https://shebox.wcd.gov.in");
  await expect(page.getByText(/not legal or medical advice|isn't legal or medical advice/)).toBeVisible();
});

test("a saved report becomes a complaint letter", async ({ page }) => {
  await signUp(page, "Kavita");
  await page.goto("/report");
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "Harassment" }).click();
  await page.getByLabel("Incident Description *").fill("A man grabbed my arm at the bus stop and followed me.");
  await page.getByPlaceholder(/Where did this occur/).fill("Sector 18 bus stop");
  await page.getByRole("button", { name: "Submit Report" }).click();
  await expect(page.getByText("Report Submitted", { exact: true })).toBeVisible();

  await page.goto("/account");
  await page.getByRole("link", { name: "Write a complaint from this report" }).click();
  await expect(page).toHaveURL(/\/complaint\?report=\d+/);
  const letter = page.getByLabel("Your letter");
  await expect(letter).toHaveValue(/A man grabbed my arm at the bus stop/);
  await expect(letter).toHaveValue(/Place: Sector 18 bus stop/);
  await expect(letter).toHaveValue(/I, Kavita,/);
  await expect(letter).toHaveValue(/Zero FIR/);

  await page.getByLabel("Police station").fill("Sector 20 Police Station");
  await expect(letter).toHaveValue(/The Station House Officer,\nSector 20 Police Station/);

  await page.getByRole("radio", { name: "Workplace committee (POSH)" }).click();
  await expect(letter).toHaveValue(/Internal Committee \(POSH\)/);
  await expect(page.getByRole("link", { name: "Email" })).toHaveAttribute("href", /^mailto:\?subject=Complaint%20of%20sexual%20harassment/);

  // The letter can be in another language than the app, e.g. Tamil for a station in Chennai.
  await page.getByLabel("Letter language").selectOption("ta");
  await expect(letter).toHaveValue(/பொருள்: POSH சட்டம்/);
  await expect(letter).toHaveValue(/Kavita ஆகிய நான்/);
  await expect(page.getByRole("link", { name: "Email" })).toHaveAttribute("href", new RegExp(`subject=${encodeURIComponent("POSH")}`));
  await page.getByLabel("Letter language").selectOption("en");

  // Printing shows only the letter, not the form.
  const printed = page.locator(".print-doc");
  await expect(printed).toBeHidden();
  await page.emulateMedia({ media: "print" });
  await expect(printed).toBeVisible();
  await expect(printed).toContainText("Internal Committee (POSH)");
  await expect(page.getByLabel("Police station")).toBeHidden();
});
