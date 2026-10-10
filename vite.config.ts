/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import crypto from "crypto";
import path from "path";
import type { Plugin } from "vite";

// Lists every built file so the service worker can store the whole app for offline use,
// including pages the user hasn't opened yet.
const precacheManifest = (): Plugin => ({
  name: "herspace-precache-manifest",
  apply: "build",
  generateBundle(_options, bundle) {
    const files = Object.keys(bundle)
      .filter((f) => f.startsWith("assets/") && !f.endsWith(".map"))
      .map((f) => `/${f}`)
      .sort();
    this.emitFile({ type: "asset", fileName: "precache-manifest.json", source: JSON.stringify({ files }) });
  },
});

// A Content-Security-Policy in the web build, so the browser refuses scripts from anywhere but
// HerSpace itself, even if an attacker found a way to inject some. It's in the page rather than
// left to the web host, so every build carries it and the browser tests run with it. The host
// should still send HSTS and frame-ancestors, which a page can't set (see deploy/).
// Not in the Android build: the app's WebView has its own rules.
const contentSecurityPolicy = (): Plugin => ({
  name: "herspace-csp",
  apply: (_config, { command, mode }) => command === "build" && mode !== "android",
  transformIndexHtml: {
    order: "post",
    handler(html) {
      // The theme script runs before the app loads; it's allowed by its hash, so nothing else inline is.
      // Browsers hash it with Unix line endings, whatever the file on disk has (Windows checkouts).
      const hash = (script: string) => crypto.createHash("sha256").update(script.replace(/\r\n?/g, "\n")).digest("base64");
      const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => `'sha256-${hash(m[1])}'`);
      const policy = [
        "default-src 'self'",
        `script-src 'self' ${inline.join(" ")}`,
        // Map libraries and toasts set styles inline.
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https://*.tile.openstreetmap.org",
        "media-src 'self' blob:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "worker-src 'self'",
        "manifest-src 'self'",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'self'",
      ].join("; ");
      return html.replace("<head>", `<head>
    <meta http-equiv="Content-Security-Policy" content="${policy}" />`);
    },
  },
});

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      "/api": {
        // The end-to-end tests point this at their own isolated API server.
        target: process.env.API_PROXY_TARGET || "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  plugins: [react(), precacheManifest(), contentSecurityPolicy()],
  // Unit tests (Vitest). Browser tests live in e2e/ and server tests in server/.
  test: { include: ["src/**/*.test.ts"] },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
