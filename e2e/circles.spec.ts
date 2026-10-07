import { test, expect } from "@playwright/test";
import { signUp } from "./helpers";

test("Safe Circles: start a circle, post anonymously, flag, and a moderator bans the author unseen", async ({ page, browser }) => {
  await signUp(page, "Oorja");
  await page.goto("/circles");
  await page.getByRole("button", { name: "Start a circle" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name", { exact: true }).fill("Hostel 4 Women");
  await dialog.getByLabel("What it's for").fill("Safety updates and support for hostel residents.");
  await dialog.getByLabel("Type").selectOption("college");
  await dialog.getByRole("button", { name: "Start circle" }).click();
  await expect(page.getByRole("heading", { name: "Hostel 4 Women" })).toBeVisible();
  const code = (await page.getByLabel("Circle code").textContent())!.trim();

  // A member joins with the code and posts an alert without her name.
  const memberContext = await browser.newContext();
  const member = await memberContext.newPage();
  await signUp(member, "Mira");
  await member.goto("/circles");
  await member.getByLabel("Have a circle code?").fill(code);
  await member.getByRole("button", { name: "Join", exact: true }).click();
  await expect(member.getByRole("heading", { name: "Hostel 4 Women" })).toBeVisible();
  await member.getByRole("button", { name: "Safety alert" }).click();
  await member.getByLabel("Write a post").fill("Back gate road has no streetlights tonight, use the main gate.");
  await member.getByLabel("Post anonymously").click();
  await member.getByRole("button", { name: "Post", exact: true }).click();
  const memberPost = member.getByRole("article").filter({ hasText: "Back gate road" });
  await expect(memberPost).toContainText("you, anonymously");

  // The owner sees it as from an anonymous member, and comments.
  await page.reload();
  const post = page.getByRole("article").filter({ hasText: "Back gate road" });
  await expect(post).toContainText("Anonymous member");
  await expect(post).not.toContainText("Mira");
  await post.getByLabel("Write a comment").fill("Thanks, I'll tell the warden.");
  await post.getByRole("button", { name: "Send comment" }).click();
  await expect(post).toContainText("Thanks, I'll tell the warden.");
  await expect(post).toContainText("Oorja");

  // Flagged, it shows up for moderation, still anonymous; removing it can ban the author unseen.
  await post.getByRole("button", { name: "Post options" }).click();
  await page.getByRole("menuitem", { name: "False or misleading" }).click();
  await page.getByRole("tab", { name: "Moderation" }).click();
  const flagged = page.getByRole("article").filter({ hasText: "Back gate road" });
  await expect(flagged).toContainText("1 flag:");
  await expect(flagged).toContainText("Anonymous member");
  await flagged.getByRole("button", { name: "Remove and ban the author" }).click();
  await expect(page.getByText("Nothing has been flagged.")).toBeVisible();

  await member.reload();
  await expect(member.getByRole("heading", { name: "Circle not found" })).toBeVisible();
  await memberContext.close();
});
