import { test, expect } from "@playwright/test";
import { signUp } from "./helpers";

// A 1x1 PNG: the record keeps photos as they are.
const PHOTO = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

test("the private record is encrypted on the phone, opens only with her PIN or recovery code, and locks itself", async ({ page }) => {
  test.setTimeout(120_000);
  // Everything sent to the server for the record must be unreadable.
  const sent: string[] = [];
  page.on("request", (r) => r.url().includes("/api/record") && r.method() !== "GET" && sent.push(r.postData() ?? ""));

  await signUp(page, "Sunita");
  await page.goto("/account");
  await page.getByRole("link", { name: /Private record/ }).click();
  await expect(page).toHaveURL(/\/record$/);

  // A weak PIN is refused; then the record is created and the recovery code shown once.
  await page.getByLabel("PIN", { exact: true }).fill("1234");
  await page.getByLabel("PIN again").fill("1234");
  await page.getByRole("button", { name: "Create my private record" }).click();
  await expect(page.getByText("Use at least 6 digits")).toBeVisible();
  await page.getByLabel("PIN", { exact: true }).fill("482916");
  await page.getByLabel("PIN again").fill("482916");
  await page.getByRole("button", { name: "Create my private record" }).click();
  const code = (await page.getByLabel("Your recovery code").textContent())!.trim();
  expect(code).toMatch(/^([2-9A-Z]{4}-){4}[2-9A-Z]{4}$/);
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
  await page.getByText("I've written it down or given it to someone I trust").click();
  await page.getByRole("button", { name: "Continue" }).click();

  // An entry with a photo.
  await page.getByLabel("What happened").fill("He threw a plate at me after dinner and said he would lock me out");
  await page.getByLabel("Injuries").fill("Cut on my left arm");
  await page.getByLabel("Who saw or heard").fill("Mrs Rao next door");
  await page.getByLabel("Photos").setInputFiles({ name: "arm.png", mimeType: "image/png", buffer: PHOTO });
  await page.getByRole("button", { name: "Save to my record" }).click();
  await expect(page.getByRole("heading", { name: "1 entry" })).toBeVisible();
  await expect(page.getByText("He threw a plate at me")).toBeVisible();
  expect(sent.join("\n")).not.toMatch(/plate|Rao|arm/);

  // Locked: a wrong PIN says so; the right one opens it, decrypted, with the photo.
  await page.getByRole("button", { name: "Lock now" }).click();
  await expect(page.getByText("He threw a plate at me")).toHaveCount(0);
  await expect(page.getByText("Your record is locked")).toBeVisible();
  await page.getByLabel("PIN", { exact: true }).fill("111111");
  await expect(page.getByLabel("PIN", { exact: true })).toHaveValue("111111");
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("That's not right");
  await page.getByLabel("PIN", { exact: true }).fill("482916");
  await page.getByRole("button", { name: "Open" }).click();
  await expect(page.getByText("Cut on my left arm")).toBeVisible();
  await page.getByRole("button", { name: "Show 1 photo" }).click();
  await expect(page.getByRole("img", { name: "Photo 1" })).toBeVisible();

  // Leaving the app (someone takes the phone) locks it at once.
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.getByText("Your record is locked")).toBeVisible();
  await page.evaluate(() => Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true }));

  // Forgot the PIN: the recovery code, typed loosely, opens it and sets a new one.
  await page.getByRole("button", { name: "Forgot your PIN?" }).click();
  await page.getByLabel("Recovery code").fill(code.toLowerCase().replace(/-/g, " "));
  await page.getByRole("button", { name: "Open" }).click();
  await page.getByLabel("PIN", { exact: true }).fill("731905");
  await page.getByLabel("PIN again").fill("731905");
  await page.getByRole("button", { name: "Save new PIN" }).click();
  await expect(page.getByText("He threw a plate at me")).toBeVisible();
  await page.getByRole("button", { name: "Lock now" }).click();

  // Five wrong tries lock it for a while, even for the right PIN.
  for (let i = 1; i <= 5; i++) {
    await page.getByLabel("PIN", { exact: true }).fill("000000");
    const reply = page.waitForResponse((r) => r.url().endsWith("/api/record/unlock"));
    await page.getByRole("button", { name: "Open" }).click();
    expect((await reply).status()).toBe(i < 5 ? 401 : 429);
  }
  await expect(page.getByText("Too many wrong tries")).toBeVisible();
  await expect(page.getByLabel("PIN", { exact: true })).toHaveCount(0);
});
