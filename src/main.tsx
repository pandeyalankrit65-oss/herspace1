import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { isNative } from "./lib/native";
import { initialLang, loadLang } from "./i18n";

// A saved language other than English is its own file: load it first, so the app doesn't
// flash in English. If it can't load, the app starts in English.
loadLang(initialLang())
  .catch(() => {})
  .finally(() => createRoot(document.getElementById("root")!).render(<App />));

// Offline support (production only; a service worker would fight Vite's dev server).
// (Not in the Android app: its pages are already stored on the phone.)
if (import.meta.env.PROD && !isNative && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => navigator.serviceWorker.ready)
      .then((registration) => {
        const loaded = performance
          .getEntriesByType("resource")
          .map((entry) => entry.name)
          .filter((name) => new URL(name).pathname.startsWith("/assets/"));
        registration.active?.postMessage({ type: "CACHE_URLS", urls: loaded });
        // Store the rest of the app (every page) so it all works offline.
        registration.active?.postMessage({ type: "PRECACHE" });
      })
      .catch((err) => console.warn("Service worker registration failed:", err));
  });
}

// In development, a service worker left over from a production build on the same address
// would keep serving stored copies of old code. Remove it and its stored files, then load
// the page once more so it comes straight from the dev server.
if (import.meta.env.DEV && "serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then(async (registrations) => {
    if (registrations.length === 0) return;
    await Promise.all(registrations.map((r) => r.unregister()));
    if ("caches" in window) await Promise.all((await caches.keys()).map((key) => caches.delete(key)));
    window.location.reload();
  });
}
