import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export type Daily = { active: false } | { active: true; deadline: string; nextDueAt: string; lastOkAt: string | null; lastAlertedAt: string | null };

// The daily check-in ("I'm fine by 10:00 each day"), kept on the server so a missed day is noticed
// even if her phone is off.
export function useDailyCheckIn() {
  const { user } = useAuth();
  const [daily, setDaily] = useState<Daily | null>(null);
  useEffect(() => {
    if (!user) return setDaily(null);
    api<Daily>("/api/daily-checkin").then(setDaily).catch(() => setDaily(null));
  }, [user]);
  const turnOn = useCallback(async (deadline: string) => {
    setDaily(await api<Daily>("/api/daily-checkin", { method: "PUT", body: { deadline, utcOffset: -new Date().getTimezoneOffset() } }));
  }, []);
  const imFine = useCallback(async () => {
    const res = await api<Daily & { told: number }>("/api/daily-checkin/ok", { body: {} });
    setDaily(res);
    return res.told;
  }, []);
  const pause = useCallback(async (days: number) => setDaily(await api<Daily>("/api/daily-checkin/pause", { body: { days } })), []);
  const turnOff = useCallback(async () => setDaily(await api<Daily>("/api/daily-checkin", { method: "DELETE" })), []);
  return { daily, turnOn, imFine, pause, turnOff };
}
