import { useCallback, useEffect, useState } from "react";
import { onAppVisibility } from "./appVisibility";

// Disguised mode: for someone whose phone may be checked by an abuser. HerSpace opens as a
// working calculator; typing the PIN and "=" opens the real app. An optional second code
// sends a silent SOS straight from the calculator. Settings live only on this device, and
// the codes are stored as hashes.

const SETTINGS_KEY = "herspace_disguise";
const UNLOCK_KEY = "herspace_unlocked";
const QUICK_EXIT_KEY = "herspace_quick_exit";
// Going to the background for longer than this locks the app again.
const RELOCK_AFTER_MS = 60_000;

export type DisguiseSettings = { enabled: boolean; pinHash: string; sosCodeHash?: string | null };

export async function hashCode(code: string): Promise<string> {
  const data = new TextEncoder().encode(`herspace-disguise:${code}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function readDisguise(): DisguiseSettings | null {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const parsed = raw ? (JSON.parse(raw) as DisguiseSettings) : null;
    return parsed?.enabled && parsed.pinHash ? parsed : null;
  } catch {
    return null;
  }
}

export function saveDisguise(settings: DisguiseSettings | null) {
  try {
    if (settings) localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    else localStorage.removeItem(SETTINGS_KEY);
  } catch {
    // Storage blocked: disguise can't be kept on this device.
  }
  window.dispatchEvent(new Event("herspace-disguise"));
}

const isUnlocked = () => {
  try {
    return sessionStorage.getItem(UNLOCK_KEY) === "1";
  } catch {
    return false;
  }
};

const setUnlocked = (on: boolean) => {
  try {
    if (on) sessionStorage.setItem(UNLOCK_KEY, "1");
    else sessionStorage.removeItem(UNLOCK_KEY);
  } catch {
    // ignore
  }
};

// Whether the calculator should be shown instead of the app, and how to unlock it.
export function useDisguise() {
  const [settings, setSettings] = useState(readDisguise);
  const [unlocked, setUnlockedState] = useState(isUnlocked);

  useEffect(() => {
    const reload = () => {
      setSettings(readDisguise());
      setUnlockedState(isUnlocked());
    };
    window.addEventListener("herspace-disguise", reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener("herspace-disguise", reload);
      window.removeEventListener("storage", reload);
    };
  }, []);

  // Lock again after the app has been in the background for a while.
  useEffect(() => {
    if (!settings) return;
    let hiddenAt = 0;
    return onAppVisibility((visible) => {
      if (!visible) hiddenAt ||= Date.now();
      else {
        if (hiddenAt && Date.now() - hiddenAt > RELOCK_AFTER_MS) {
          setUnlocked(false);
          window.dispatchEvent(new Event("herspace-disguise"));
        }
        hiddenAt = 0;
      }
    });
  }, [settings]);

  // Every component using this hook follows lock/unlock through the event.
  const unlock = useCallback(() => {
    setUnlocked(true);
    window.dispatchEvent(new Event("herspace-disguise"));
  }, []);

  const lock = useCallback(() => {
    setUnlocked(false);
    window.dispatchEvent(new Event("herspace-disguise"));
  }, []);

  return { settings, locked: Boolean(settings) && !unlocked, unlock, lock };
}

// Quick exit: leave for an ordinary page at once, and replace this page in the history so
// "back" doesn't return to HerSpace.
export const QUICK_EXIT_URL = "https://www.google.com/search?q=weather+today";
export function quickExit() {
  window.location.replace(QUICK_EXIT_URL);
}

export function readQuickExit(): boolean {
  try {
    return localStorage.getItem(QUICK_EXIT_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveQuickExit(on: boolean) {
  try {
    localStorage.setItem(QUICK_EXIT_KEY, on ? "1" : "0");
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event("herspace-quick-exit"));
}

export function useQuickExitEnabled() {
  const [on, setOn] = useState(readQuickExit);
  useEffect(() => {
    const reload = () => setOn(readQuickExit());
    window.addEventListener("herspace-quick-exit", reload);
    return () => window.removeEventListener("herspace-quick-exit", reload);
  }, []);
  return on;
}

// Silent SOS: no vibration or sound on this phone, and contacts are asked not to call.
const SILENT_KEY = "herspace_silent_sos";
export function readSilentSos(): boolean {
  try {
    return localStorage.getItem(SILENT_KEY) === "1";
  } catch {
    return false;
  }
}
export function useSilentSos() {
  const [on, setOn] = useState(readSilentSos);
  const set = (next: boolean) => {
    setOn(next);
    try {
      localStorage.setItem(SILENT_KEY, next ? "1" : "0");
    } catch {
      // ignore
    }
  };
  return { silent: on, setSilent: set };
}
// Vibrates unless silent SOS is on.
export const vibrate = (pattern: number | number[]) => {
  if (!readSilentSos()) navigator.vibrate?.(pattern);
};
