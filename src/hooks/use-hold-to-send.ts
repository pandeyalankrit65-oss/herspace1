import { vibrate } from "@/lib/disguise";
import { useCallback, useEffect, useRef, useState } from "react";

export type SosMode = "tap" | "hold";
const STORAGE_KEY = "herspace_sos_mode";

function readMode(): SosMode {
  try {
    return localStorage.getItem(STORAGE_KEY) === "hold" ? "hold" : "tap";
  } catch {
    return "tap";
  }
}

// How the SOS button starts an alert: tap and then a cancellable countdown (default), or
// press and hold for a few seconds, which suits pressing it by feel in a pocket or bag.
export function useSosMode() {
  const [mode, setModeState] = useState<SosMode>(readMode);
  const setMode = (next: SosMode) => {
    setModeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // private mode: the choice lasts for this visit only
    }
  };
  return { mode, setMode };
}

/**
 * Calls `onComplete` once the button has been held for `ms`. Letting go earlier cancels.
 * Works with touch, mouse and the keyboard (holding Space or Enter).
 */
export function useHoldToSend(onComplete: () => void, ms: number) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<number>();
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const cancel = useCallback(() => {
    window.clearTimeout(timer.current);
    setHolding(false);
  }, []);

  const start = useCallback(() => {
    window.clearTimeout(timer.current);
    setHolding(true);
    vibrate(30);
    timer.current = window.setTimeout(() => {
      setHolding(false);
      vibrate(200);
      onCompleteRef.current();
    }, ms);
  }, [ms]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const handlers = {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      // Keep receiving pointerup even if the finger slides a little.
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      start();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onKeyDown: (e: React.KeyboardEvent) => {
      if ((e.key === " " || e.key === "Enter") && !e.repeat) {
        e.preventDefault();
        start();
      }
    },
    onKeyUp: (e: React.KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") cancel();
    },
    onBlur: cancel,
    // A long press on phones would otherwise open the context menu.
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };

  return { holding, handlers };
}
