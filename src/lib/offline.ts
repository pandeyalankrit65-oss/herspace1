import { useEffect, useState } from "react";
import { JOURNEY_KEY, PLACES_KEY } from "./places";
import { clearRoutines } from "./routines";

// Last-known copies of the signed-in user and their contacts, kept on this device so the
// SOS page can still offer "text / call" buttons when there's no connection to the server.
const USER_KEY = "herspace_offline_user";
const CONTACTS_KEY = "herspace_offline_contacts";

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: offline fallback just won't be available.
  }
}

export const offlineUser = {
  get: <T>() => read<T>(USER_KEY),
  set: (user: unknown) => write(USER_KEY, user),
};

export const offlineContacts = {
  get: <T>() => read<T[]>(CONTACTS_KEY) ?? [],
  set: (contacts: unknown[]) => write(CONTACTS_KEY, contacts),
};

export function clearOfflineData() {
  try {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(CONTACTS_KEY);
    localStorage.removeItem(PLACES_KEY);
    localStorage.removeItem(JOURNEY_KEY);
    clearRoutines();
  } catch {
    // ignore
  }
}

// navigator.onLine isn't reliable everywhere (Android's WebView can say "online" in airplane
// mode), so every API request also reports whether the server could be reached.
const REACHABLE = "herspace-reachable";
let reachable: boolean | null = null;
// When the phone says it's back online, trust that until a request says otherwise.
if (typeof window !== "undefined") window.addEventListener("online", () => (reachable = null));
export function reportReachable(ok: boolean) {
  if (ok === reachable) return;
  reachable = ok;
  window.dispatchEvent(new CustomEvent(REACHABLE, { detail: ok }));
}

export function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine && reachable !== false));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    const reach = (e: Event) => setOnline((e as CustomEvent<boolean>).detail);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    window.addEventListener(REACHABLE, reach);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      window.removeEventListener(REACHABLE, reach);
    };
  }, []);
  return online;
}

// Last-known copies of public data (map incidents, nearby help), shown when offline.
// Nothing personal is kept here.
const SAVED_PREFIX = "herspace_saved_";
export const savedData = {
  get: <T>(key: string) => read<{ data: T; at: string }>(SAVED_PREFIX + key),
  set: (key: string, data: unknown) => write(SAVED_PREFIX + key, { data, at: new Date().toISOString() }),
};
