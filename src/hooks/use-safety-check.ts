import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { vibrate } from "@/lib/disguise";
import { metresBetween } from "@/lib/places";
import { motionBetween, paceOf } from "@/lib/motion";
import { ANSWER_MS, LONG_STOP_MS, SafetyCheck, SuddenRun, isDark, type Clue } from "@/lib/safetyCheck";
import type { AreaWarning } from "@/lib/risk";
import { notifyNow } from "@/lib/timerNotifications";
import { useI18n } from "@/i18n";

const SETTING_KEY = "herspace_safety_check";
// Pace from positions this far apart; closer fixes are mostly GPS noise.
const SAMPLE_MS = 10_000;
// Moving less than this doesn't end a stop.
const STOP_RADIUS_M = 50;
const NOTIFICATION_ID = 9100;

export const readSafetyCheck = () => {
  try {
    return localStorage.getItem(SETTING_KEY) === "on";
  } catch {
    return false;
  }
};
export const writeSafetyCheck = (on: boolean) => {
  try {
    if (on) localStorage.setItem(SETTING_KEY, "on");
    else localStorage.removeItem(SETTING_KEY);
  } catch {
    // private mode: lasts for this visit only
  }
};

// Off unless she turns it on, before or during a journey.
export function useSafetyCheckSetting() {
  const [on, setOn] = useState(readSafetyCheck);
  return {
    on,
    setOn: (value: boolean) => {
      setOn(value);
      writeSafetyCheck(value);
    },
  };
}

type Fix = { lat: number; lng: number; accuracy?: number | null };
export type Asking = { since: number; reasons: Clue[] };

// During a journey: notes clues (running suddenly, an area with reports, a long stop, and a scream
// or a stressed voice if she turned those on), asks "Are you okay?" when they add up, and sends a
// silent SOS if she doesn't answer in time.
export function useSafetyCheck(active: boolean) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [asking, setAsking] = useState<Asking | null>(null);
  const [now, setNow] = useState(Date.now());
  const askingRef = useRef<Asking | null>(null);
  const check = useRef(new SafetyCheck());
  const run = useRef(new SuddenRun());
  const sample = useRef<{ coords: Fix; at: number } | null>(null);
  const stop = useRef<{ coords: Fix; at: number; noted: boolean } | null>(null);

  const sendSos = useCallback(
    (trigger: "no_answer" | "button") => {
      askingRef.current = null;
      setAsking(null);
      // Router state, not the URL: a link someone sends her can't fire an SOS.
      navigate("/sos", { state: { autoSos: trigger } });
    },
    [navigate]
  );

  const clue = useCallback(
    (c: Clue) => {
      if (!active || askingRef.current) return;
      const at = Date.now();
      if (!check.current.add(c, at)) return;
      const ask = { since: at, reasons: check.current.reasons(at) };
      askingRef.current = ask;
      setNow(at);
      setAsking(ask);
      vibrate([400, 200, 400, 200, 400]);
      void notifyNow(NOTIFICATION_ID, t("check.title"), t("check.notify"), "/walk");
    },
    [active, t]
  );

  const okay = useCallback(() => {
    check.current.okay();
    askingRef.current = null;
    setAsking(null);
  }, []);

  // A position during the journey, with the area warning there if any.
  const onFix = useCallback(
    (pos: Fix, warning: AreaWarning | null) => {
      if (!active) return;
      const at = Date.now();
      // Late timers (a locked screen) still catch up when the next position arrives.
      if (askingRef.current && at - askingRef.current.since >= ANSWER_MS) return sendSos("no_answer");

      if (warning) clue(isDark() && warning.timeOfDay !== "day" ? "risky_area_dark" : "risky_area");

      const prev = sample.current;
      if (!prev || at - prev.at >= SAMPLE_MS) {
        const motion = prev ? motionBetween(prev, pos, at) : undefined;
        sample.current = { coords: pos, at };
        if (motion && run.current.push(paceOf(motion.speed), at)) clue("running");
      }

      const s = stop.current;
      if (!s || metresBetween(s.coords, pos) >= STOP_RADIUS_M) stop.current = { coords: pos, at, noted: false };
      else if (!s.noted && at - s.at >= LONG_STOP_MS) {
        s.noted = true;
        clue("long_stop");
      }
    },
    [active, clue, sendSos]
  );

  // The countdown, and the vibration again every few seconds while she hasn't answered.
  useEffect(() => {
    if (!asking) return;
    const timer = setInterval(() => {
      const at = Date.now();
      setNow(at);
      if (at - asking.since >= ANSWER_MS) sendSos("no_answer");
      else if (Math.round((at - asking.since) / 1000) % 5 === 0) vibrate([400, 200, 400]);
    }, 1000);
    return () => clearInterval(timer);
  }, [asking, sendSos]);

  const secondsLeft = asking ? Math.max(0, Math.ceil((asking.since + ANSWER_MS - now) / 1000)) : 0;
  return { asking, secondsLeft, onFix, clue, okay, sendNow: () => sendSos("button") };
}

export type SafetyCheckState = ReturnType<typeof useSafetyCheck>;
