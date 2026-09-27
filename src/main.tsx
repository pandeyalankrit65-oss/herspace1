import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { isNative } from "./lib/native";

createRoot(document.getElementById("root")!).render(<App />);

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
      })
      .catch((err) => console.warn("Service worker registration failed:", err));
  });
}
