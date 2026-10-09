import { defineConfig, devices } from "@playwright/test";
import fs from "fs";
import path from "path";

// End-to-end tests run the real production build against an isolated API server: its own
// port, a fresh SQLite file, and an outbox file instead of real SMS/email. They never read
// server/.env, so real credentials can't be used.
const API_PORT = 3101;
const WEB_PORT = 4174;
const OSM_PORT = 3102;
const tmp = path.resolve("e2e/.tmp");

// Each run gets its own folder; old ones would pile up. Before a new run (main process only:
// workers inherit E2E_RUN_DIR), keep the newest few, and anything under an hour old in case
// another run is still using it.
const KEEP_RUNS = 5;
if (!process.env.E2E_RUN_DIR && fs.existsSync(tmp)) {
  const runs = fs
    .readdirSync(tmp)
    .filter((name) => /^run-\d+$/.test(name))
    .sort((a, b) => Number(b.slice(4)) - Number(a.slice(4)));
  for (const name of runs.slice(KEEP_RUNS)) {
    if (Date.now() - Number(name.slice(4)) > 60 * 60 * 1000) fs.rmSync(path.join(tmp, name), { recursive: true, force: true });
  }
}

// Set once in the main process; worker processes inherit these values.
process.env.E2E_RUN_DIR ??= path.join(tmp, `run-${Date.now()}`);
process.env.E2E_OUTBOX ??= path.join(process.env.E2E_RUN_DIR, "outbox.jsonl");
fs.mkdirSync(process.env.E2E_RUN_DIR, { recursive: true });

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1, // one shared server and outbox; tests use unique accounts
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    // Locally, `PW_CHANNEL=chrome` uses the installed Chrome instead of downloading Chromium.
    channel: process.env.PW_CHANNEL || undefined,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      command: "node e2e/stub-osm.mjs",
      url: `http://localhost:${OSM_PORT}/health`,
      reuseExistingServer: false,
      env: { STUB_OSM_PORT: String(OSM_PORT) },
    },
    {
      command: "npm run build --prefix server && node server/dist/index.js",
      url: `http://localhost:${API_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        PORT: String(API_PORT),
        HERSPACE_SKIP_ENV_FILE: "1",
        NODE_ENV: "test",
        DATABASE_PATH: path.join(process.env.E2E_RUN_DIR, "e2e.db"),
        MESSAGE_OUTBOX: process.env.E2E_OUTBOX,
        APP_URL: `http://localhost:${WEB_PORT}`,
        DISABLE_IP_RATE_LIMIT: "1",
        CHECK_IN_POLL_MS: "1000", // so an expired safety timer alerts within a second
        NOMINATIM_URL: `http://localhost:${OSM_PORT}`,
        OVERPASS_URL: `http://localhost:${OSM_PORT}/interpreter`,
        ADMIN_EMAILS: "moderator-desktop@example.com,moderator-phone@example.com,partners-mod-desktop@example.com,partners-mod-phone@example.com,trust-mod-desktop@example.com,trust-mod-phone@example.com",
        UPLOAD_DIR: path.join(process.env.E2E_RUN_DIR, "uploads"),
      },
    },
    {
      command: `npm run build && npx vite preview --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: { API_PROXY_TARGET: `http://localhost:${API_PORT}` },
    },
  ],
});
