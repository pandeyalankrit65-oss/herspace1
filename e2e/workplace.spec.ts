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
