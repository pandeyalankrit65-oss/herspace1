/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
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
  plugins: [react(), precacheManifest()],
  // Unit tests (Vitest). Browser tests live in e2e/ and server tests in server/.
  test: { include: ["src/**/*.test.ts"] },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
