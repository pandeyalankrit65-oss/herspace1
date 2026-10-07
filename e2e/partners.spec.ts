import { test, expect } from "@playwright/test";
import { signUp, uniqueEmail, uniquePhone, waitForMessage } from "./helpers";

test("partner network: nobody is listed until checked; a session request reaches the partner by email", async ({ page, browser }, testInfo) => {
  // With no checked partner for a kind of help, the official helplines are offered instead.
  await page.goto("/partners");
  await page.getByRole("button", { name: "Doctor" }).click();
  await expect(page.getByText("No checked partners match that yet.")).toBeVisible();
  await expect(page.getByRole("link", { name: /181/ })).toHaveAttribute("href", "tel:181");

  // A counsellor applies.
  const name = `Meena Rao Counselling ${testInfo.project.name} ${Date.now()}`;
  const listingEmail = uniqueEmail("meena");
  const partnerContext = await browser.newContext();
  const partner = await partnerContext.newPage();
  const account = await signUp(partner, "Meena");
  await partner.goto("/partners/join");
  await partner.getByLabel("Your name or organisation").fill(name);
  await partner.getByLabel("What you do").selectOption("counsellor");
  await partner.getByLabel("City", { exact: true }).fill("Pune");
  await partner.getByLabel("About your work").fill("Trauma-informed counselling for women, online and in Kothrud.");
  await partner.getByLabel("Registration or credentials").fill("RCI registration CRR/12345");
  await partner.getByRole("checkbox", { name: "मराठी" }).click();
  await partner.getByLabel("Email for requests").fill(listingEmail);
  await partner.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(partner.getByText("Waiting to be checked")).toBeVisible();

  await page.getByRole("button", { name: "Counsellor" }).click();
  await expect(page.getByRole("article").filter({ hasText: name })).toHaveCount(0);

  // A HerSpace moderator checks the credentials and approves.
  const modContext = await browser.newContext();
  const mod = await modContext.newPage();
  await signUp(mod, "Moderator", `partners-mod-${testInfo.project.name}@example.com`);
  await mod.goto("/moderation");
  const application = mod.getByRole("article").filter({ hasText: name });
  await expect(application).toContainText("RCI registration CRR/12345");
  await application.getByRole("button", { name: "Approve and list" }).click();
  await waitForMessage((m) => m.channel === "email" && m.to === account.email && m.subject === "Your HerSpace listing is live");

  // A user finds the counsellor; the listing shows no private contact details.
  await signUp(page, "Asha");
  await page.goto("/partners");
  await page.getByRole("button", { name: "Counsellor" }).click();
  const card = page.getByRole("article").filter({ hasText: name });
  await expect(card).toContainText("Checked by HerSpace on");
  await expect(card).not.toContainText(listingEmail);
  await expect(card).not.toContainText("CRR/12345");
  await card.getByRole("button", { name: "Request a session" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Phone" }).click();
  const phone = uniquePhone();
  await dialog.getByLabel("Your phone number").fill(phone);
  await dialog.getByLabel("Message (optional)").fill("I'd like to talk about something at work.");
  await expect(dialog.getByRole("button", { name: "Send request" })).toBeDisabled();
  await dialog.getByRole("checkbox").click();
  await dialog.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByText(`${name} will contact you directly.`).first()).toBeVisible();

  const request = await waitForMessage((m) => m.channel === "email" && m.to === listingEmail);
  expect(request.subject).toBe("A session request from HerSpace");
  expect(request.body).toContain(phone);
  expect(request.body).toContain("I'd like to talk about something at work.");
  expect(request.body).toContain("Asha");

  await partnerContext.close();
  await modContext.close();
});
