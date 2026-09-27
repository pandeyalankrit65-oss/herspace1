import { useEffect, useState } from "react";

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
  } catch {
    // ignore
  }
}

export function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}
