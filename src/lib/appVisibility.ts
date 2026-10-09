import { App } from "@capacitor/app";
import { isNative } from "./native";

// Calls `fn(false)` when the app goes to the background (someone takes the phone, she switches
// apps) and `fn(true)` when it's back. In a browser that's the page's visibility. Android's WebView
// doesn't reliably report it (found on the emulator), so in the app Capacitor's app state is
// used as well; a repeated call is harmless to everything that uses this.
export function onAppVisibility(fn: (visible: boolean) => void): () => void {
  const onChange = () => fn(document.visibilityState === "visible");
  document.addEventListener("visibilitychange", onChange);
  const handle = isNative ? App.addListener("appStateChange", ({ isActive }) => fn(isActive)) : null;
  return () => {
    document.removeEventListener("visibilitychange", onChange);
    void handle?.then((h) => h.remove());
  };
}
