// Android app check: drives the HerSpace app on a running emulator through its WebView
// (Chrome DevTools Protocol over adb) and checks native behaviour through adb: SOS with audio
// recording, battery and emergency info, photos, the evidence pack's print dialog, automatic
// arrival, a ride heading the wrong way, the safe word and voice commands, the fake call's voice,
// follow-up notifications (and their text hidden by disguised mode), the private record's
// encryption and lock, and offline reports.
//
// Usage:  npm run test:android            (the app must already be installed)
//         npm run test:android -- --install   (installs the debug APK first)
//
// Needs: an emulator running (e.g. `emulator -avd <name>`), the app built with .env.android
// (`npm run android:apk`), and port 3001 free: this script starts its own throwaway API server
// there, because the app built for the emulator calls http://10.0.2.2:3001.
// Speech can't be spoken into the emulator, so recognizer results are delivered the way the
// native plugin delivers them: through the Capacitor bridge.
// Results and screenshots go to test-results/android/.
const { _android } = require("playwright-core");
const { execSync, spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const RUN = path.join(ROOT, "test-results", "android");
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), "herspace-android-"));
const OUTBOX = path.join(DATA, "outbox.jsonl");
const API = "http://localhost:3001/api";
const APK = path.join(ROOT, "android", "app", "build", "outputs", "apk", "debug", "app-debug.apk");
const SDK = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
const ADB = process.env.ADB || (SDK ? path.join(SDK, "platform-tools", process.platform === "win32" ? "adb.exe" : "adb") : "adb");
const adb = (args) => execSync(`"${ADB}" ${args}`, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
const shot = (name) => fs.writeFileSync(path.join(RUN, `${name}.png`), execSync(`"${ADB}" exec-out screencap -p`, { maxBuffer: 64 * 1024 * 1024 }));
const fail = (message) => {
  console.error(`\n${message}\n`);
  process.exit(2);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const outbox = () => (fs.existsSync(OUTBOX) ? fs.readFileSync(OUTBOX, "utf8").split("\n").filter(Boolean).map(JSON.parse) : []);
const results = [];
const check = (name, ok, detail = "") => {
  results.push(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  console.log(results.at(-1));
};
async function waitFor(fn, ms = 20000, every = 500) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    let v;
    try {
      v = await fn();
    } catch {
      v = undefined;
    }
    if (v) return v;
    await sleep(every);
  }
  return undefined;
}
const visible = (locator) => locator.isVisible().catch(() => false);
function uiText() {
  adb("shell uiautomator dump /sdcard/ui.xml");
  return adb("shell cat /sdcard/ui.xml");
}
function tapDialogButton(pattern) {
  const xml = uiText();
  const node = [...xml.matchAll(/<node [^>]*>/g)].map((m) => m[0]).find((n) => pattern.test(n) && /clickable="true"|Button/.test(n));
  if (!node) return false;
  const [, x1, y1, x2, y2] = /bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(node).map(Number);
  adb(`shell input tap ${(x1 + x2) / 2} ${(y1 + y2) / 2}`);
  return true;
}
const geo = (lat, lng) => adb(`emu geo fix ${lng} ${lat}`);
const START = { lat: 28.6139, lng: 77.209 };
const HOME = { lat: 28.6315, lng: 77.2167 };

// Records the callback ids of the speech plugin's "partialResults" listeners, so a result can
// be delivered exactly as the native plugin would. Must run after each page load.
async function hookSpeech(page) {
  await page.evaluate(() => {
    const cap = window.Capacitor;
    if (cap.__hooked) return;
    cap.__hooked = true;
    window.__speechIds = [];
    const orig = cap.nativeCallback.bind(cap);
    cap.nativeCallback = (plugin, method, options, cb) => {
      const id = orig(plugin, method, options, cb);
      if (plugin === "SpeechRecognition" && method === "addListener" && options?.eventName === "partialResults") window.__speechIds.push(id);
      return id;
    };
    // One-shot recognition (voice commands) resolves start(); answer it with a queued phrase.
    const origPromise = cap.nativePromise.bind(cap);
    cap.nativePromise = (plugin, method, options) => {
      if (plugin === "SpeechRecognition" && method === "start" && options?.partialResults === false && window.__nextHeard) {
        const matches = [window.__nextHeard];
        window.__nextHeard = null;
        return new Promise((r) => setTimeout(() => r({ matches }), 800));
      }
      const result = origPromise(plugin, method, options);
      if (plugin === "TextToSpeech" && method === "speak") {
        const entry = { text: options.text.slice(0, 30), lang: options.lang, status: "speaking" };
        (window.__tts ||= []).push(entry);
        result.then(() => (entry.status = "finished"), (e) => (entry.status = `error: ${e.message}`));
      }
      return result;
    };
  });
}
const hear = (page, text) =>
  page.evaluate((text) => {
    const id = window.__speechIds.at(-1);
    if (!id) return false;
    window.Capacitor.fromNative({ callbackId: id, pluginId: "SpeechRecognition", methodName: "addListener", save: true, success: true, data: { matches: [text] } });
    return true;
  }, text);
const nativeListening = (page) =>
  page.evaluate(() => window.Capacitor.Plugins.SpeechRecognition.isListening().then((r) => r.listening)).catch(() => false);

let currentSection = "start";
// The SOS page folds its settings away.
const openSosSettings = async (page) => {
  const button = page.getByRole("button", { name: /^SOS settings/ });
  if ((await button.getAttribute("aria-expanded")) !== "true") await button.click();
};
const pendingNotifications = (page) =>
  page.evaluate(() => window.Capacitor.Plugins.LocalNotifications.getPending().then((r) => r.notifications)).catch(() => []);

async function section(name, fn) {
  currentSection = name;
  try {
    await fn();
  } catch (e) {
    check(`${name}: finished without an error`, false, String(e.message).split("\n")[0].slice(0, 200));
    try {
      shot(`error-${name.replace(/\W+/g, "-")}`);
    } catch {}
  }
}

// A fresh API server with a temporary database; texts go to an outbox file instead of Twilio.
async function startServer() {
  if (await fetch(`${API}/health`).then(() => true, () => false)) {
    fail("Something is already running on port 3001 (your dev server?). Stop it first: this check starts its own server there.");
  }
  console.log("Building the API server...");
  execSync("npm run build --prefix server", { cwd: ROOT, stdio: "ignore" });
  const log = fs.openSync(path.join(RUN, "server.log"), "w");
  const server = spawn(process.execPath, ["dist/index.js"], {
    cwd: path.join(ROOT, "server"),
    env: {
      ...process.env,
      HERSPACE_SKIP_ENV_FILE: "1",
      NODE_ENV: "development",
      DATABASE_PATH: path.join(DATA, "app.db"),
      MESSAGE_OUTBOX: OUTBOX,
      UPLOAD_DIR: path.join(DATA, "uploads"),
      NOMINATIM_URL: "off",
      OVERPASS_URL: "off",
      APP_URL: "http://localhost:8080",
    },
    stdio: ["ignore", log, log],
  });
  if (!(await waitFor(() => fetch(`${API}/health`).then((r) => r.ok), 30000))) fail("The API server didn't start. See test-results/android/server.log.");
  return server;
}

function preflight() {
  let devices;
  try {
    devices = adb("devices");
  } catch {
    fail(`adb not found at ${ADB}. Set ANDROID_HOME (or ADB) to your Android SDK.`);
  }
  if (!/^emulator-\d+\s+device$/m.test(devices)) fail("No emulator is running. Start one first, e.g. `emulator -avd <name>`.");
  if (process.argv.includes("--install")) {
    if (!fs.existsSync(APK)) fail("No debug APK found. Build it with `npm run android:apk`.");
    console.log("Installing the app...");
    adb(`install -r "${APK}"`);
  }
  if (!adb("shell pm path app.herspace").includes("package:")) fail("HerSpace isn't installed on the emulator. Run with --install, or install the APK.");
}

(async () => {
  fs.rmSync(RUN, { recursive: true, force: true });
  fs.mkdirSync(RUN, { recursive: true });
  preflight();
  const server = await startServer();
  const resultsFile = path.join(RUN, "results.txt");
  try {
    adb("shell pm clear app.herspace");
    // Microphone is left ungranted: the recording and voice prompts are part of the test.
    for (const p of ["ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION", "POST_NOTIFICATIONS"]) adb(`shell pm grant app.herspace android.permission.${p}`);
    // A nearly flat, unplugged battery, through Android's battery service: the emulator's own
    // power commands crash the system UI on newer images, which sleeps the screen mid-run.
    adb("shell dumpsys battery unplug");
    adb("shell dumpsys battery set level 12");
    // Keep the screen on and unlocked for the whole run: a sleeping screen pauses the WebView.
    adb("shell svc power stayon true");
    adb("shell input keyevent KEYCODE_WAKEUP");
    adb("shell wm dismiss-keyguard");
    geo(START.lat, START.lng);
    adb("shell am start -n app.herspace/.MainActivity");
    await sleep(6000);
    const [device] = await _android.devices();
    const page = await (await device.webView({ pkg: "app.herspace" })).page();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(`[${currentSection}] ${e.message}`));
    // Move between screens the way the app does (no page reload), as a user would; only the
    // first visit loads the page. A reload while Android is sending the app an event (e.g. a
    // network change) trips over Capacitor's bridge, which never happens in normal use.
    let loaded = false;
    const go = async (p) => {
      if (!loaded) {
        await page.goto(`https://localhost${p}`);
        loaded = true;
      } else {
        await page.evaluate((to) => {
          window.history.pushState({}, "", to);
          window.dispatchEvent(new PopStateEvent("popstate"));
        }, p);
        await page.waitForLoadState("networkidle").catch(() => {});
        await sleep(500);
      }
      await hookSpeech(page);
    };

    // --- Account with a confirmed contact ---
    const phone = `+9198${String(Date.now()).slice(-8)}`;
    await section("sign up", async () => {
      await go("/signup");
      await page.getByLabel("Name").fill("Asha");
      await page.getByLabel("Email").fill(`android.${Date.now()}@example.com`);
      await page.getByLabel("Password").fill("password123");
      await page.getByRole("button", { name: "Create account" }).click();
      check("sign up", !!(await waitFor(async () => page.url().endsWith("/contacts"))));
      await page.getByRole("button", { name: "Add Contact" }).click();
      await page.getByLabel("Name").fill("Mom");
      await page.getByLabel("Phone (with country code)").fill(phone);
      await page.getByRole("button", { name: "Add", exact: true }).click();
      const invite = await waitFor(async () => outbox().reverse().find((m) => m.to === phone && m.body.includes("/confirm-contact/")));
      const token = invite.body.match(/confirm-contact\/(\S+)/)[1];
      await fetch(`${API}/contact-invites/${token}`, { method: "POST", headers: { "Content-Type": "application/json", "X-Requested-With": "HerSpace" }, body: JSON.stringify({ accept: true }) });
      await page.getByRole("button", { name: "Done" }).click();
      await go("/");
      await go("/contacts");
      check("contact confirmed", await visible(page.getByText("Confirmed", { exact: true }).first()) || !!(await waitFor(() => visible(page.getByText("Confirmed", { exact: true }).first()), 8000)));
    });

    // --- Emergency info ---
    await section("emergency info", async () => {
      await go("/account");
      await page.getByLabel("Blood group").selectOption("B+");
      await page.getByLabel("Allergies").fill("Penicillin");
      await page.getByLabel("Show this to my contacts during an SOS").click();
      await page.getByRole("button", { name: "Save", exact: true }).click();
      check("emergency info saved", !!(await waitFor(() => visible(page.getByText("Emergency info saved", { exact: true }).first()))));
    });

    // --- Saved place (standing at home) ---
    await section("saved place", async () => {
      // The app accepts a position up to 30 seconds old, so wait until the phone itself reports
      // Home: otherwise a previous run's last position can be used.
      geo(HOME.lat, HOME.lng);
      await waitFor(async () => {
        geo(HOME.lat, HOME.lng);
        const at = await page.evaluate(
          () =>
            new Promise((ok) =>
              navigator.geolocation.getCurrentPosition((p) => ok(p.coords.latitude), () => ok(null), { maximumAge: 0, enableHighAccuracy: true, timeout: 5000 })
            )
        );
        return at !== null && Math.abs(at - HOME.lat) < 0.0005;
      }, 30000, 2000);
      await go("/account");
      await page.getByRole("button", { name: "Add a place" }).click();
      const pinned = await waitFor(() => visible(page.getByTestId("place-map").locator(".leaflet-interactive")), 20000);
      check("the pin starts at the phone's GPS position", !!pinned);
      await page.getByRole("button", { name: "Save place" }).click();
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("herspace_places") || "[]"));
      const home = saved[0];
      check("Home saved on the phone", home?.label === "Home" && Math.abs(home.lat - HOME.lat) < 0.001, home ? `${home.lat.toFixed(4)},${home.lng.toFixed(4)}` : "none");
      shot("1-saved-place");
      geo(START.lat, START.lng);
    });

    // --- SOS with audio recording, battery and emergency info on the live link ---
    let trackToken = null;
    await section("sos recording", async () => {
      await go("/sos");
      await openSosSettings(page);
      await page.locator("#record-toggle").click();
      await page.getByRole("button", { name: /EMERGENCY SOS/ }).click();
      const prompted = await waitFor(async () => tapDialogButton(/resource-id="[^"]*permission_allow_foreground_only_button"/), 25000, 1000);
      check("Android asks for the microphone for SOS recording", !!prompted);
      check("SOS sent", !!(await waitFor(() => visible(page.getByText("Alert sent to 1 contact")), 25000)));
      // "How are you doing?" tomorrow at 10, as a real Android notification.
      const followUp = await waitFor(async () => (await pendingNotifications(page)).find((n) => n.id === 30000), 10000);
      check("tomorrow's follow-up is scheduled on the phone", !!followUp, followUp ? `${followUp.title}: ${followUp.body}` : "none");
      const recording = await waitFor(() => visible(page.getByText(/Recording audio as evidence · [1-9]/)), 40000, 1000);
      check("audio pieces upload during the SOS", !!recording, recording ? await page.getByText(/Recording audio as evidence/).innerText() : "");
      shot("2-sos-recording");
      const sms = outbox().reverse().find((m) => m.to === phone && m.body.startsWith("HerSpace SOS"));
      trackToken = sms?.body.match(/track\/(\S+)/)?.[1]; // with the contact's ?c= code, like their SMS
      // Let at least one location update carry the battery level.
      const view = await waitFor(async () => {
        const v = await (await fetch(`${API}/track/${trackToken}`)).json();
        return v.battery ? v : null;
      }, 45000, 3000);
      check("contacts see the phone's battery", view?.battery?.level === 0.12 && view.battery.charging === false, JSON.stringify(view?.battery));
      check("contacts see the emergency info during the SOS", view?.emergencyInfo?.bloodGroup === "B+" && view.emergencyInfo.allergies === "Penicillin");
      await page.getByRole("button", { name: "Stop", exact: true }).click().catch(() => {});
      await page.getByRole("button", { name: "I'm safe, stop sharing" }).click();
      await sleep(1500);
    });

    // --- Evidence pack: native print dialog ---
    await section("evidence pack", async () => {
      await go("/report");
      await page.getByRole("combobox").click();
      await page.getByRole("option", { name: "Stalking" }).click();
      await page.getByLabel("Incident Description *").fill("Followed from the metro.");
      const jpeg = await page.evaluate(() => {
        const c = document.createElement("canvas");
        c.width = 64;
        c.height = 48;
        c.getContext("2d").fillRect(0, 0, 64, 48);
        return c.toDataURL("image/jpeg").split(",")[1];
      });
      await page.getByLabel("Photos (optional)").setInputFiles({ name: "car.jpg", mimeType: "image/jpeg", buffer: Buffer.from(jpeg, "base64") });
      await page.getByRole("button", { name: "Submit Report" }).click();
      await waitFor(() => visible(page.getByText("Report Submitted", { exact: true })));
      await go("/account");
      check("report photo uploads from the app", !!(await waitFor(() => visible(page.getByRole("img", { name: "Photo 1" }).first()), 15000)));
      await go("/account");
      await page.getByRole("link", { name: "Evidence pack (PDF)" }).first().click();
      const doc = page.locator(".print-doc");
      check("evidence pack lists the SOS with its recording", !!(await waitFor(() => visible(doc.getByText(/^Audio: [1-9]\d* pieces recorded/)), 15000)));
      await page.getByRole("button", { name: "Save as PDF / Print" }).click();
      const dialog = await waitFor(async () => /com\.android\.printspooler|Save as PDF|Select a printer/i.test(uiText()), 20000, 1500);
      check("tapping Save as PDF opens Android's print dialog", !!dialog);
      await sleep(2500);
      shot("3-print-dialog");
      tapDialogButton(/text="Select a printer"|resource-id="[^"]*destination_spinner"/);
      await sleep(2000);
      const pdfOption = /Save as PDF/i.test(uiText());
      shot("3b-printers");
      check("the print dialog offers Save as PDF", pdfOption);
      // Back closes the printer list first, then the print dialog itself.
      for (let i = 0; i < 4 && /com\.android\.printspooler/.test(uiText()); i++) {
        adb("shell input keyevent KEYCODE_BACK");
        await sleep(1500);
      }
      check("closing the print dialog returns to the app", !/com\.android\.printspooler/.test(uiText()));
    });

    // --- Walk to a saved place: automatic arrival ---
    await section("arrival", async () => {
      geo(START.lat, START.lng);
      await go("/walk");
      await page.getByRole("button", { name: "Home", exact: true }).click();
      await page.getByRole("button", { name: "Start sharing" }).click();
      check("journey heading Home", !!(await waitFor(() => visible(page.getByText("Heading to Home. Sharing stops by itself when you get there.")))));
      const arrived = await waitFor(async () => {
        geo(HOME.lat + (Math.random() - 0.5) * 0.0004, HOME.lng);
        return visible(page.getByText("You've reached Home"));
      }, 40000, 3000);
      check("arrival detected from real GPS fixes", !!arrived);
      shot("4-arrival-countdown");
      check("sharing stops by itself after the countdown", !!(await waitFor(() => visible(page.getByText("Glad you made it", { exact: true }).first()), 50000, 1000)));
      const sms = await waitFor(async () => outbox().reverse().find((m) => m.to === phone && m.body.includes("has arrived")), 10000);
      check("contact texted on arrival", sms?.body === "HerSpace: Asha has arrived at Home. No action needed.", sms?.body);
    });

    // --- Voice: native recognizer, safe word and "help me" ---
    await section("voice", async () => {
      await go("/sos");
      await openSosSettings(page);
      await page.getByRole("button", { name: "Set", exact: true }).click();
      await page.locator("#safe-word").fill("pineapple");
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await page.getByRole("button", { name: /Voice trigger/ }).click();
      check("native recognizer running", !!(await waitFor(() => nativeListening(page), 15000)));
      await sleep(1500);
      await hear(page, "pineapple");
      await sleep(700);
      const early = await visible(page.getByText("Sending alert..."));
      check("once isn't enough", !early);
      await hear(page, "pineapple pineapple pineapple");
      const counting = await waitFor(() => visible(page.getByText("Sending alert...")), 6000, 200);
      check("safe word said 3 times starts the SOS countdown", !!counting);
      shot("5-safe-word-countdown");
      if (counting) await page.getByRole("button", { name: "Cancel" }).click();
      await sleep(2500);
      await hear(page, "help me");
      const help = await waitFor(() => visible(page.getByText("Sending alert...")), 6000, 200);
      check("\"help me\" starts the countdown", !!help);
      if (help) await page.getByRole("button", { name: "Cancel" }).click();
      await page.getByRole("button", { name: /Listening for|Say your safe word|Say "help"/ }).first().click().catch(() => {});
    });

    await section("voice command", async () => {
      await go("/");
      await page.evaluate(() => (window.__nextHeard = "open my contacts"));
      await page.getByRole("button", { name: "Voice command" }).first().click();
      check("voice command \"open my contacts\" navigates", !!(await waitFor(async () => page.url().endsWith("/contacts"), 15000)), page.url());
    });

    // --- Fake call voice ---
    await section("fake call", async () => {
      await go("/sos");
      const tts = await page.evaluate(() => ({ api: "speechSynthesis" in window, voices: "speechSynthesis" in window ? speechSynthesis.getVoices().length : 0 }));
      await page.getByRole("button", { name: "Now", exact: true }).click();
      await page.getByRole("button", { name: "Schedule call" }).click();
      const ringing = await waitFor(() => visible(page.getByRole("dialog", { name: "Incoming call" })), 10000);
      check("fake call rings", !!ringing);
      shot("6a-fake-call-ringing");
      await page.getByRole("button", { name: "Accept" }).click();
      await sleep(3000);
      const spoken = await waitFor(async () => {
        const calls = await page.evaluate(() => window.__tts || []);
        return calls.find((c) => c.status === "finished" || c.status.startsWith("error"));
      }, 30000, 1000);
      check("fake call caller speaks with Android's voice", spoken?.status === "finished", JSON.stringify(spoken));
      shot("6-fake-call");
      await page.getByRole("button", { name: "End call" }).click().catch(() => {});
    });

    // --- A ride heading the wrong way, from real GPS fixes ---
    await section("ride off route", async () => {
      geo(START.lat, START.lng);
      await go("/walk");
      await page.getByRole("tab", { name: "Cab or auto" }).click();
      await page.getByLabel("Vehicle number").fill("DL 1C AB 1234");
      await page.getByRole("button", { name: "Home", exact: true }).click();
      await page.getByRole("button", { name: "Start sharing" }).click();
      await waitFor(() => visible(page.getByText(/Heading to Home/)));
      // Closer first, then further and further south, every 25 seconds.
      const warning = page.getByText("Your ride seems to be heading away from Home");
      let lat = START.lat + 0.004;
      geo(lat, START.lng);
      const noticed = await waitFor(async () => {
        lat -= 0.004;
        geo(lat, START.lng);
        return visible(warning);
      }, 180000, 25000);
      check("a ride heading away from home is noticed", !!noticed);
      shot("5-off-route");
      await page.getByRole("button", { name: /I've arrived/ }).click().catch(() => {});
      await page.getByRole("button", { name: /Stop now|stop sharing/i }).first().click().catch(() => {});
    });

    // --- Private record: encryption in the WebView, and the lock when the app is left ---
    await section("private record", async () => {
      await go("/record");
      await page.getByLabel("PIN", { exact: true }).fill("482916");
      await page.getByLabel("PIN again").fill("482916");
      await page.getByRole("button", { name: "Create my private record" }).click();
      check("record created (WebCrypto works in Android's WebView)", !!(await waitFor(() => visible(page.getByText("Your recovery code")), 30000)));
      await page.getByText("I've written it down or given it to someone I trust").click();
      await page.getByRole("button", { name: "Continue" }).click();
      await page.getByLabel("What happened").fill("Written on the phone, encrypted before upload.");
      await page.getByRole("button", { name: "Save to my record" }).click();
      check("entry saved", !!(await waitFor(() => visible(page.getByRole("heading", { name: "1 entry" })), 20000)));
      // Someone takes the phone: Home, then back to the app.
      adb("shell input keyevent KEYCODE_HOME");
      await sleep(2000);
      adb("shell am start -n app.herspace/.MainActivity");
      check("leaving the app locks the record", !!(await waitFor(() => visible(page.getByText("Your record is locked")), 15000)));
      shot("6-record-locked");
      await page.getByLabel("PIN", { exact: true }).fill("482916");
      await page.getByRole("button", { name: "Open" }).click();
      check("the PIN opens it again, decrypted", !!(await waitFor(() => visible(page.getByText("Written on the phone, encrypted before upload.")), 30000)));
      await page.getByRole("button", { name: "Lock now" }).click();
    });

    // --- Disguised calculator ---
    await section("disguise", async () => {
      await go("/account");
      await page.getByLabel("PIN (4 to 8 digits)").fill("2468");
      await page.getByLabel("PIN again").fill("2468");
      await page.getByLabel("SOS code (optional)").fill("1357");
      await page.getByRole("button", { name: "Turn on disguised mode" }).click();
      const hidden = await waitFor(async () => (await pendingNotifications(page)).find((n) => n.id === 30000 && n.title === "Reminder"), 10000);
      check("disguised mode hides the text of notifications already scheduled", !!hidden, hidden ? `${hidden.title}: ${hidden.body}` : "still revealing");
      await page.getByRole("button", { name: "Lock now" }).click();
      const calc = page.getByRole("main", { name: "Calculator" });
      check("locks to a calculator", !!(await waitFor(() => visible(calc), 8000)));
      shot("7-calculator");
      const press = async (keys) => {
        for (const k of keys) await calc.getByRole("button", { name: k, exact: true }).click();
      };
      const before = outbox().length;
      await press(["1", "3", "5", "7", "="]);
      const silent = await waitFor(async () => outbox().slice(before).find((m) => m.to === phone && m.body.startsWith("HerSpace SOS")), 20000);
      check("SOS code sends a silent alert from the calculator", !!silent && (await visible(calc)), silent?.body.slice(0, 80));
      await press(["C"]).catch(() => {});
      await press(["2", "4", "6", "8", "="]);
      check("PIN opens the app", !!(await waitFor(async () => !(await visible(calc)), 8000)));
      // A minute in the background (someone picks up the phone later): it's a calculator again.
      adb("shell input keyevent KEYCODE_HOME");
      await sleep(65000);
      adb("shell am start -n app.herspace/.MainActivity");
      check("a minute in the background locks it to the calculator again", !!(await waitFor(() => visible(calc), 15000)));
      await press(["2", "4", "6", "8", "="]);
      await waitFor(async () => !(await visible(calc)), 8000);
      await go("/account");
      await page.getByRole("button", { name: "Turn off", exact: true }).click();
      await go("/sos");
      await page.getByRole("button", { name: "I'm safe, stop sharing" }).click().catch(() => {});
    });

    // --- Offline report ---
    await section("offline report", async () => {
      await go("/report");
      adb("shell cmd connectivity airplane-mode enable");
      await page.getByRole("combobox").click();
      await page.getByRole("option", { name: "Harassment" }).click();
      await page.getByLabel("Incident Description *").fill("Written with no signal.");
      await page.getByRole("button", { name: "Submit Report" }).click();
      check("report saved on the phone while offline", !!(await waitFor(() => visible(page.getByText("Report saved on this phone", { exact: true }).first()), 10000)));
      check("app shows it's offline (the WebView itself still says online)", !!(await waitFor(() => visible(page.getByText("You're offline · SOS still texts and calls")), 10000)));
      shot("8-offline-report");
      adb("shell cmd connectivity airplane-mode disable");
      const back = Date.now();
      const sent = await waitFor(() => visible(page.getByText(/report saved offline has been sent/).first()), 90000, 1000);
      check("queued report sent by itself once back online", !!sent, `after ${Math.round((Date.now() - back) / 1000)} s`);
      await go("/account");
      check("and it's in the account", !!(await waitFor(() => visible(page.getByText("Written with no signal.")), 15000)));
    });
    check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  } finally {
    try {
      adb("shell cmd connectivity airplane-mode disable");
      adb("shell dumpsys battery reset");
      adb("shell svc power stayon false");
    } catch {}
    server.kill();
    fs.writeFileSync(resultsFile, results.join("\n"));
  }
  const failed = results.filter((r) => r.startsWith("FAIL")).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed. Screenshots and results: test-results/android/`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
