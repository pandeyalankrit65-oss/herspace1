import { test, expect } from "@playwright/test";
import { signUp, verifyEmail, waitForMessage } from "./helpers";

test("Corporate Connect: an employee reports to HR anonymously and they talk it through", async ({ page, browser }) => {
  // HR sets up the workplace; test accounts are @example.com, so that's HR's own domain.
  const hema = await signUp(page, "Hema");
  // A workplace domain needs an email the person has proved is theirs.
  await verifyEmail(page, hema.email);
  await page.goto("/corporate");
  await page.getByLabel("Organisation name").fill("Acme Textiles");
  await page.getByLabel("Work email domain (optional)").fill("example.com");
  await page.getByRole("button", { name: "Set up workplace" }).click();
  await expect(page.getByRole("heading", { name: "Your workplace code" })).toBeVisible();
  const code = (await page.getByLabel("Workplace code").first().textContent())!.trim();
  expect(code).toMatch(/^[A-Z2-9]{4} [A-Z2-9]{4}$/);

  // Alerts go to Slack, and never carry what was written or who wrote it.
  await page.getByRole("tab", { name: "Settings" }).click();
  await page.getByLabel("Slack incoming webhook").fill("https://hooks.slack.com/services/T0/B0/e2e");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible();

  // An employee joins with the code and reports, without sharing her name.
  const employeeContext = await browser.newContext();
  const employee = await employeeContext.newPage();
  const esha = await signUp(employee, "Esha");
  await verifyEmail(employee, esha.email);
  await employee.goto("/corporate");
  await employee.getByLabel("Workplace code").fill(code.toLowerCase());
  await employee.getByRole("button", { name: "Join", exact: true }).click();
  await expect(employee.getByText("Verified @example.com")).toBeVisible();
  await employee.getByLabel("What happened", { exact: true }).selectOption("harassment");
  await employee.getByLabel("Describe what happened").fill("A senior colleague keeps sending me messages late at night.");
  await employee.getByRole("button", { name: "Send to HR" }).click();
  await expect(employee.getByText("HR can reply here without knowing who you are.").first()).toBeVisible();

  const alert = await waitForMessage((m) => m.channel === "webhook" && m.body.includes("Acme Textiles"));
  expect(alert.to).toBe("https://hooks.slack.com/services/T0/B0/e2e");
  expect(alert.body).not.toContain("late at night");
  expect(alert.body).not.toContain("Esha");

  // HR sees the report, but not who sent it, and replies.
  await page.getByRole("tab", { name: "Reports" }).click();
  await page.getByRole("button", { name: "Refresh" }).click();
  const report = page.getByRole("article").filter({ hasText: "late at night" });
  await expect(report).toContainText("Anonymous employee");
  await expect(report).not.toContainText("Esha");
  await report.getByLabel("Reply to the employee").fill("Thank you for telling us. Do you still have the messages?");
  await report.getByRole("button", { name: "Send" }).click();
  await expect(report.getByText("Do you still have the messages?")).toBeVisible();
  await expect(report).toContainText("Being reviewed");

  // The employee gets an email that there's a reply (not the reply itself), and reads it in HerSpace.
  const email = await waitForMessage((m) => m.channel === "email" && m.to === esha.email && m.subject === "Your HR team replied in HerSpace");
  expect(email.body).not.toContain("messages?");
  await employee.reload();
  const mine = employee.getByRole("article").filter({ hasText: "late at night" });
  await expect(mine.getByText("Do you still have the messages?")).toBeVisible();
  await mine.getByLabel("Reply to HR").fill("Yes, I took screenshots.");
  await mine.getByRole("button", { name: "Send" }).click();
  await expect(mine.getByText("Yes, I took screenshots.")).toBeVisible();

  // Insights: totals only; too few reports for a breakdown by type.
  await page.getByRole("tab", { name: "Insights" }).click();
  await expect(page.getByText("Shown once there are at least 3 reports")).toBeVisible();
  await employeeContext.close();
});

test("the only HR person is warned before deleting their account, and can still delete it", async ({ page, browser }) => {
  const hr = await signUp(page, "Hari");
  await verifyEmail(page, hr.email);
  await page.goto("/corporate");
  await page.getByLabel("Organisation name").fill("Lone HR Pvt Ltd");
  await page.getByRole("button", { name: "Set up workplace" }).click();
  await expect(page.getByRole("heading", { name: "Your workplace code" })).toBeVisible();
  const code = (await page.getByLabel("Workplace code").first().textContent())!.trim();
  const colleagueContext = await browser.newContext();
  const colleague = await colleagueContext.newPage();
  await signUp(colleague, "Chitra");
  await colleague.goto("/corporate");
  await colleague.getByLabel("Workplace code").fill(code);
  await colleague.getByRole("button", { name: "Join", exact: true }).click();
  await expect(colleague.getByRole("button", { name: "Send to HR" })).toBeVisible();

  await page.goto("/account");
  await page.getByRole("button", { name: "Delete my account" }).click();
  await page.getByLabel("Password").last().fill("password123");
  await page.getByRole("button", { name: "Permanently delete" }).click();
  const warning = page.getByRole("alert").filter({ hasText: "You're the only HR person at Lone HR Pvt Ltd" });
  await expect(warning).toBeVisible();
  await expect(page.getByRole("button", { name: "Permanently delete" })).toBeDisabled();
  await warning.getByText("I understand, delete my account anyway").click();
  await page.getByRole("button", { name: "Permanently delete" }).click();
  await expect(page).toHaveURL(/\/$/);
  await colleagueContext.close();
});

test("Internal Committee: the committee is checked against the POSH Act, a report becomes a formal complaint with its deadlines, and the annual report", async ({ page, browser }) => {
  const hr = await signUp(page, "Indira");
  await verifyEmail(page, hr.email);
  await page.goto("/corporate");
  await page.getByLabel("Organisation name").fill("Posh Textiles");
  await page.getByRole("button", { name: "Set up workplace" }).click();
  await expect(page.getByRole("heading", { name: "Your workplace code" })).toBeVisible();
  const code = (await page.getByLabel("Workplace code").first().textContent())!.trim();
  expect(code).toMatch(/^[A-Z2-9]{4} [A-Z2-9]{4}$/);

  const staffContext = await browser.newContext();
  const staff = await staffContext.newPage();
  await signUp(staff, "Sana");
  await staff.goto("/corporate");
  await staff.getByLabel("Workplace code").fill(code);
  await staff.getByRole("button", { name: "Join", exact: true }).click();
  await expect(staff.getByRole("button", { name: "Send to HR" })).toBeVisible();
  await staff.getByLabel("What happened", { exact: true }).selectOption("harassment");
  await staff.getByLabel("Describe what happened").fill("My team lead keeps touching my shoulder after I asked him to stop.");
  await staff.getByRole("button", { name: "Send to HR" }).click();
  await expect(staff.getByText("HR can reply here without knowing who you are.").first()).toBeVisible();

  // The committee: a Presiding Officer and one employee member isn't enough.
  await page.reload();
  await page.getByRole("tab", { name: "Internal Committee" }).click();
  await expect(page.getByRole("alert")).toContainText("There's no Presiding Officer.");
  for (const name of ["Indira", "Arun"]) {
    await page.getByRole("button", { name: "Add a member" }).click();
    await page.getByLabel("Name").last().fill(name);
  }
  await page.getByLabel("Role").last().selectOption("employee");
  await page.getByRole("checkbox", { name: "Woman" }).last().click();
  await page.getByRole("button", { name: "Save committee" }).click();
  const problems = page.getByRole("alert");
  await expect(problems).toContainText("At least two employee members are needed.");
  await expect(problems).toContainText("An external member (from an NGO or with legal knowledge) is needed.");
  await expect(problems).not.toContainText("Presiding Officer");

  // Her report becomes a formal complaint; the first deadline is 7 days on.
  await page.getByLabel("Complaint", { exact: true }).selectOption({ index: 1 });
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const formal = page.getByRole("article", { name: /Complaint received on/ });
  await expect(formal.getByRole("status")).toContainText("Copy to the respondent by");
  await formal.getByLabel("Copy sent to the respondent").fill(new Date().toLocaleDateString("en-CA"));
  await expect(formal.getByRole("status")).toContainText("Respondent's reply by");

  // She sees it's being handled formally, and by when.
  await staff.reload();
  await expect(staff.getByText(/handling this as a formal POSH complaint.*the inquiry must be completed by/)).toBeVisible();

  await expect(page.getByText(/Internal Committee annual report, Posh Textiles/)).toBeVisible();
  await expect(page.locator("dl")).toContainText("Complaints received1");
  await staffContext.close();
});
