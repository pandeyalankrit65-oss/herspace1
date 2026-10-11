import { test, expect, type Page } from "@playwright/test";
import { signUp } from "./helpers";

// A second of real, playable audio, recorded by the browser itself (WebM, as phones record).
async function recordTone(page: Page) {
  const base64 = await page.evaluate(async () => {
    const audio = new AudioContext();
    await audio.resume();
    const tone = audio.createOscillator();
    const out = audio.createMediaStreamDestination();
    tone.connect(out);
    tone.start();
    const recorder = new MediaRecorder(out.stream);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    const done = new Promise((r) => (recorder.onstop = r));
    recorder.start();
    await new Promise((r) => setTimeout(r, 1000));
    recorder.stop();
    await done;
    tone.stop();
    const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer());
    let s = "";
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s);
  });
  return Buffer.from(base64, "base64");
}

// An MP4 the way a phone camera writes one, with where it was filmed in moov/udta.
function mp4WithLocation() {
  const box = (type: string, ...parts: Buffer[]) => {
    const body = Buffer.concat(parts);
    const head = Buffer.alloc(8);
    head.writeUInt32BE(8 + body.length);
    head.write(type, 4, "latin1");
    return Buffer.concat([head, body]);
  };
  return Buffer.concat([
    box("ftyp", Buffer.from("isom\0\0\x02\0isomiso2mp41", "latin1")),
    box("moov", box("mvhd", Buffer.alloc(100)), box("udta", box("\xa9xyz", Buffer.from("\0\x0f\x15\xc7+22.5726+088.3639/", "latin1")))),
    box("mdat", Buffer.from("video frames", "latin1")),
  ]);
}

test("audio and video are attached to a report, the video without its location, and she can play them", async ({ page }) => {
  await signUp(page, "Mitali");
  const tone = await recordTone(page);
  await page.goto("/report");
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "Harassment" }).click();
  await page.getByLabel("Incident Description *").fill("He shouted at me on the platform");

  const picker = page.getByLabel("Audio or video (optional)");
  await picker.setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("not a recording") });
  await expect(page.getByText("Only audio and video files can be added here.", { exact: true })).toBeVisible();
  await picker.setInputFiles([
    { name: "what-he-said.webm", mimeType: "audio/webm", buffer: tone },
    { name: "platform.mp4", mimeType: "video/mp4", buffer: mp4WithLocation() },
  ]);
  await expect(page.getByText("what-he-said.webm")).toBeVisible();
  await expect(page.getByText("platform.mp4")).toBeVisible();
  // Two at most: the button to add more goes away.
  await expect(page.getByRole("button", { name: "Add audio or video" })).toHaveCount(0);
  await page.getByRole("button", { name: "Remove platform.mp4" }).click();
  await expect(page.getByRole("button", { name: "Add audio or video" })).toBeVisible();
  await picker.setInputFiles({ name: "platform.mp4", mimeType: "video/mp4", buffer: mp4WithLocation() });

  await page.getByRole("button", { name: "Submit Report" }).click();
  await expect(page.getByText("Report Submitted", { exact: true })).toBeVisible();
  await expect(page.getByText("what-he-said.webm")).toHaveCount(0); // form cleared

  const { reports } = await (await page.request.get("/api/reports")).json();
  const report = reports.find((r: { description: string }) => r.description === "He shouted at me on the platform");
  expect(report.media.map((m: { kind: string }) => m.kind)).toEqual(["audio", "video"]);
  const video = await (await page.request.get(`/api/reports/${report.id}/media/${report.media[1].id}`)).body();
  expect(video.includes(Buffer.from("udta"))).toBe(false);
  expect(video.includes(Buffer.from("video frames"))).toBe(true);

  // Her account plays it (fetched with her session only when she presses Play).
  await page.goto("/account");
  await expect(page.getByText("He shouted at me on the platform")).toBeVisible();
  await expect(page.getByText("Video 2")).toBeVisible();
  await page.getByRole("button", { name: "Play Audio 1" }).click();
  const player = page.locator("audio[aria-label=\"Audio 1\"]");
  await expect(player).toBeVisible();
  await expect.poll(() => player.evaluate((a: HTMLAudioElement) => a.readyState)).toBeGreaterThanOrEqual(1);
  await expect(page.getByRole("link", { name: "Download Audio 1" })).toBeVisible();

  // The evidence pack lists them, since they can't be printed.
  await page.goto(`/evidence/${report.id}`);
  await expect(page.getByRole("heading", { name: "Audio and video (2)" })).toBeVisible();
});
