import { Capacitor } from "@capacitor/core";

// True inside the Android app, false in a browser.
export const isNative = Capacitor.isNativePlatform();

// In the app, pages are served from the phone itself, so API calls need the server's full
// address. In the browser the site and API share an origin, so relative paths work.
const API_BASE = isNative ? (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "") : "";

export const apiUrl = (path: string) => `${API_BASE}${path}`;

// Binary uploads must be a File: in the app, Capacitor's native HTTP sends a File's bytes as
// they are but serializes a plain Blob as JSON, which corrupts it. Browsers send both as is.
export const asUpload = (blob: Blob, name: string, type: string) => new File([blob], name, { type });

if (isNative && !API_BASE) {
  console.error("VITE_API_BASE_URL is not set: the app can't reach the HerSpace server.");
}
