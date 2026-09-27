import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "herspace_shake";
// A hard shake: well above walking, running or putting the phone down (about 2.5 g).
const JOLT = 25; // m/s², gravity included
const JOLTS_NEEDED = 3;
const WINDOW_MS = 1500;
const MIN_GAP_MS = 120; // one swing of the arm produces several readings; count it once
const COOLDOWN_MS = 5000;

export const shakeSupported = () =>
  typeof window !== "undefined" && "DeviceMotionEvent" in window && window.matchMedia?.("(pointer: coarse)").matches;

function readSetting() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Calls `onShake` when the phone is shaken hard a few times in quick succession, if the user
 * turned it on. Like the voice trigger, it only works while the page is open and the screen is on.
 */
export function useShakeTrigger(onShake: () => void) {
  const [enabled, setEnabledState] = useState(readSetting);
  const onShakeRef = useRef(onShake);
  onShakeRef.current = onShake;

  const setEnabled = (on: boolean) => {
    setEnabledState(on);
    try {
      localStorage.setItem(STORAGE_KEY, on ? "1" : "0");
    } catch {
      // private mode: the setting lasts for this visit only
    }
  };

  useEffect(() => {
    if (!enabled) return;
    let jolts: number[] = [];
    let cooldownUntil = 0;
    const onMotion = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity;
      if (!a || a.x == null || a.y == null || a.z == null) return;
      const now = Date.now();
      if (now < cooldownUntil || Math.hypot(a.x, a.y, a.z) < JOLT) return;
      if (jolts.length && now - jolts[jolts.length - 1] < MIN_GAP_MS) return;
      jolts = [...jolts.filter((t) => now - t < WINDOW_MS), now];
      if (jolts.length >= JOLTS_NEEDED) {
        jolts = [];
        cooldownUntil = now + COOLDOWN_MS;
        navigator.vibrate?.(200);
        onShakeRef.current();
      }
    };
    window.addEventListener("devicemotion", onMotion);
    return () => window.removeEventListener("devicemotion", onMotion);
  }, [enabled]);

  return { supported: shakeSupported(), enabled, setEnabled };
}
