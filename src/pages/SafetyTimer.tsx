import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ShieldCheck, Timer } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/i18n";
import { api, ApiError } from "@/lib/api";
import type { Contact } from "./Contacts";
import { watchLocation } from "@/lib/location";
import { cancelTimerWarning, scheduleTimerWarning } from "@/lib/timerNotifications";
import PageHeader from "@/components/PageHeader";
import NeedsInternet from "@/components/NeedsInternet";
import { useOnline } from "@/lib/offline";
import LoadingRows from "@/components/LoadingRows";

type CheckIn = {
  id: number;
  note: string | null;
  status: "active" | "alerted";
  createdAt: string;
  dueAt: string;
  alertedAt: string | null;
};

const PRESETS = [15, 30, 45, 60, 120];
const POLL_MS = 15_000;
const LOCATION_EVERY_MS = 60_000;
const WARN_BEFORE_MS = 2 * 60_000;

const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function formatLeft(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function getPosition(): Promise<GeolocationPosition | undefined> {
  if (!navigator.geolocation) return Promise.resolve(undefined);
  return new Promise((resolve) =>
    navigator.geolocation.getCurrentPosition(resolve, () => resolve(undefined), {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 30_000,
    }),
  );
}

const coordsOf = (pos: GeolocationPosition) => ({
  lat: pos.coords.latitude,
  lng: pos.coords.longitude,
  accuracy: pos.coords.accuracy,
});

const SafetyTimer = () => {
  const online = useOnline();
  const { t } = useI18n();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [checkIn, setCheckIn] = useState<CheckIn | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [confirmedContacts, setConfirmedContacts] = useState<number | null>(null);
  const [minutes, setMinutes] = useState(30);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const warnedRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api<{ checkIn: CheckIn | null }>("/api/check-ins/current");
      setCheckIn(res.checkIn);
    } catch {
      // Keep showing what we have; the server enforces the deadline regardless.
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    load();
    api<{ contacts: Contact[] }>("/api/contacts")
      .then((res) => setConfirmedContacts(res.contacts.filter((c) => c.status === "confirmed").length))
      .catch(() => setConfirmedContacts(null));
  }, [user, load]);

  // Re-check with the server (it may have sent the alert), and tick the countdown.
  useEffect(() => {
    if (!checkIn) return;
    const poll = setInterval(load, POLL_MS);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [checkIn, load]);

  // While active and open, keep the last known location fresh for the alert.
  // In the Android app this keeps going with the screen locked (showing a notification).
  const activeId = checkIn?.status === "active" ? checkIn.id : null;
  useEffect(() => {
    if (!activeId) return;
    let last = 0;
    return watchLocation(
      (pos) => {
        if (Date.now() - last < LOCATION_EVERY_MS) return;
        last = Date.now();
        api(`/api/check-ins/${activeId}/location`, { body: { coords: pos } }).catch(() => {});
      },
      () => {},
      { title: t("native.timerTitle"), message: t("native.timerMessage") },
    );
    // t is only used for the notification text when the watch starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  // App only: a system notification 2 minutes before the end, even if the app is closed.
  const activeDueAt = checkIn?.status === "active" ? checkIn.dueAt : null;
  useEffect(() => {
    if (activeId && activeDueAt)
      scheduleTimerWarning(activeId, activeDueAt, t("timer.notificationTitle"), t("timer.notificationBody"));
  }, [activeId, activeDueAt, t]);

  const msLeft = checkIn ? new Date(checkIn.dueAt).getTime() - now : 0;
  const endingSoon = checkIn?.status === "active" && msLeft <= WARN_BEFORE_MS;

  // Two minutes before the end: vibrate, and notify if the user allowed notifications.
  useEffect(() => {
    if (!endingSoon || !checkIn || warnedRef.current === checkIn.id) return;
    warnedRef.current = checkIn.id;
    navigator.vibrate?.([400, 200, 400, 200, 400]);
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(t("timer.notificationTitle"), { body: t("timer.notificationBody"), tag: "herspace-timer" });
    }
  }, [endingSoon, checkIn, t]);

  const start = async () => {
    setBusy(true);
    try {
      if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => {});
      const pos = await getPosition();
      const res = await api<{ checkIn: CheckIn }>("/api/check-ins", {
        body: { minutes, note: note.trim() || undefined, coords: pos ? coordsOf(pos) : undefined },
      });
      warnedRef.current = null;
      setNow(Date.now());
      setCheckIn(res.checkIn);
    } catch (err) {
      toast({ title: t("timer.startFailed"), description: (err as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const extend = async (extra: number) => {
    if (!checkIn) return;
    try {
      const res = await api<{ checkIn: CheckIn }>(`/api/check-ins/${checkIn.id}/extend`, { body: { minutes: extra } });
      warnedRef.current = null;
      setCheckIn(res.checkIn);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) load();
      toast({ title: t("timer.updateFailed"), description: (err as Error).message, variant: "destructive" });
    }
  };

  const complete = async () => {
    if (!checkIn) return;
    setBusy(true);
    try {
      const res = await api<{ wasAlerted: boolean }>(`/api/check-ins/${checkIn.id}/complete`, { method: "POST" });
      cancelTimerWarning(checkIn.id);
      setCheckIn(null);
      toast({ title: t("timer.safeTitle"), description: t(res.wasAlerted ? "timer.safeAfterAlertDesc" : "timer.safeDesc") });
    } catch (err) {
      toast({ title: t("timer.updateFailed"), description: (err as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const body = () => {
    if (!authLoading && !user) {
      return (
        <Card>
          <CardHeader>
            <CardDescription>{t("timer.loginDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Link to="/login?next=/timer" className="flex-1">
              <Button variant="hero" className="w-full">
                {t("common.logIn")}
              </Button>
            </Link>
            <Link to="/signup?next=/timer" className="flex-1">
              <Button variant="outline" className="w-full">
                {t("common.signUp")}
              </Button>
            </Link>
          </CardContent>
        </Card>
      );
    }
    if (!loaded) return <LoadingRows rows={1} tall />;

    if (checkIn?.status === "alerted") {
      return (
        <Card className="border-destructive" role="alert">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-6 w-6" />
              {t("timer.alertedTitle")}
            </CardTitle>
            <CardDescription>{t("timer.alertedDesc", { time: clock(checkIn.alertedAt ?? checkIn.dueAt) })}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="hero" size="lg" className="w-full gap-2" onClick={complete} disabled={busy}>
              <ShieldCheck className="h-5 w-5" /> {t("timer.safeAfterAlert")}
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (checkIn?.status === "active") {
      return (
        <Card className={endingSoon ? "border-destructive" : "border-primary/60"}>
          <CardContent className="pt-8 space-y-6 text-center">
            {endingSoon && (
              <div role="alert" className="rounded-md bg-destructive/15 border border-destructive px-4 py-3 text-left">
                <p className="font-semibold">{t("timer.soonTitle")}</p>
                <p className="text-sm text-muted-foreground">{t("timer.soonDesc")}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">{t("timer.timeLeft")}</p>
              <p className={`text-6xl font-bold tabular-nums ${endingSoon ? "text-destructive" : ""}`} aria-live="off">
                {formatLeft(msLeft)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">{t("timer.endsAt", { time: clock(checkIn.dueAt) })}</p>
              {checkIn.note && <p className="mt-2 font-medium">"{checkIn.note}"</p>}
            </div>
            <Button variant="hero" size="xl" className="w-full gap-2 text-lg" onClick={complete} disabled={busy}>
              <ShieldCheck className="h-6 w-6" /> {t("timer.safe")}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => extend(15)}>
                {t("timer.extend", { count: 15 })}
              </Button>
              <Button variant="outline" onClick={() => extend(30)}>
                {t("timer.extend", { count: 30 })}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{t("timer.keepOpen")}</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardContent className="pt-6 space-y-5">
          {confirmedContacts === 0 && (
            <div role="alert" className="rounded-md border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm space-y-2">
              <p>{t("timer.noContacts")}</p>
              <Link to="/contacts" className="font-semibold underline underline-offset-2">
                {t("sos.contacts.manage")}
              </Link>
            </div>
          )}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium mb-2">{t("timer.duration")}</legend>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {PRESETS.map((m) => (
                <Button
                  key={m}
                  type="button"
                  variant={minutes === m ? "hero" : "outline"}
                  aria-pressed={minutes === m}
                  onClick={() => setMinutes(m)}
                >
                  {m >= 60 ? t("timer.hoursShort", { count: m / 60 }) : t("timer.minutesShort", { count: m })}
                </Button>
              ))}
            </div>
          </fieldset>
          <div className="space-y-1">
            <Label htmlFor="timer-note">{t("timer.note")}</Label>
            <Input
              id="timer-note"
              value={note}
              maxLength={120}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("timer.notePlaceholder")}
            />
            <p className="text-xs text-muted-foreground">{t("timer.noteHint")}</p>
          </div>
          <Button variant="hero" size="lg" className="w-full gap-2" onClick={start} disabled={busy || !online}>
            <Timer className="h-5 w-5" /> {busy ? t("timer.starting") : t("timer.start")}
          </Button>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-xl space-y-6">
          <PageHeader icon={Timer} title={t("timer.title")} subtitle={t("timer.intro")} />
          <NeedsInternet message="offline.timer" />
          {body()}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default SafetyTimer;
