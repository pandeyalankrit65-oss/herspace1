import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Footprints, Siren, Phone, MapPin, MessageSquare, Mic, MicOff, CheckCircle2, XCircle, Timer, Vibrate, ChevronRight, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { api, EMERGENCY_NUMBER } from "@/lib/api";
import { isNative } from "@/lib/native";
import { offlineContacts, useOnline } from "@/lib/offline";
import LiveLocation, { type LiveShare } from "@/components/LiveLocation";
import FakeCall from "@/components/FakeCall";
import type { Contact } from "./Contacts";
import { useI18n } from "@/i18n";
import PageHeader from "@/components/PageHeader";
import SetupChecklist from "@/components/SetupChecklist";
import { useVoiceTrigger } from "@/hooks/use-voice-trigger";
import { useShakeTrigger } from "@/hooks/use-shake-trigger";
import { useHoldToSend, useSosMode } from "@/hooks/use-hold-to-send";
import { Switch } from "@/components/ui/switch";
import type { MessageKey } from "@/i18n/en";

type T = (key: MessageKey, vars?: Record<string, string | number>) => string;

type Coords = { lat: number; lng: number; accuracy?: number };
type Delivery = { name: string; phone: string; channel: "sms" | "call"; status: string; error?: string | null };
type SosResult = {
  id?: number;
  deliveries: Delivery[];
  smsConfigured: boolean;
  trackingDelivery?: boolean;
  share?: LiveShare | null;
  message: string;
  serverError?: string;
};

// An SMS counts as reaching the contact once Twilio accepted it; "delivered" is confirmed by the carrier.
const smsReached = (d: Delivery) => d.status === "sent" || d.status === "delivered";

function describe(d: Delivery, tracking: boolean, t: T): string {
  if (d.channel === "call") {
    const call: Record<string, MessageKey> = {
      sent: "sos.delivery.calling",
      answered: "sos.delivery.callAnswered",
      unanswered: "sos.delivery.callUnanswered",
      failed: "sos.delivery.callFailed",
    };
    return t(call[d.status] ?? "sos.delivery.callNotPlaced");
  }
  switch (d.status) {
    case "delivered":
      return t("sos.delivery.smsDelivered");
    case "sent":
      return t(tracking ? "sos.delivery.smsSentTracking" : "sos.delivery.smsSent");
    case "failed":
      return d.error ? t("sos.delivery.smsFailedWith", { error: d.error }) : t("sos.delivery.smsFailed");
    case "not_confirmed":
      return t("sos.delivery.notConfirmed");
    default:
      return t("sos.delivery.notConfigured");
  }
}

const POLL_INTERVAL_MS = 5000;
const POLL_DURATION_MS = 3 * 60 * 1000;

const COUNTDOWN_SECONDS = 3;
const HOLD_SECONDS = 3;

function getLocation(): Promise<Coords | undefined> {
  if (!navigator.geolocation) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      () => resolve(undefined),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    );
  });
}

// Written in the user's language: the contacts receiving it most likely share it.
const fallbackMessage = (t: T, name: string | undefined, coords?: Coords) => {
  const location = coords
    ? t("sos.fallbackLocation", { url: `https://maps.google.com/?q=${coords.lat},${coords.lng}` })
    : t("sos.fallbackNoLocation");
  return name ? t("sos.fallbackSms", { name, location }) : t("sos.fallbackSmsAnon", { location });
};

// "?&body=" is understood by both Android and iOS messaging apps.
const smsLink = (phone: string, body: string) => `sms:${phone}?&body=${encodeURIComponent(body)}`;

const SOS = () => {
  const { user } = useAuth();
  const { t, tn, tr, lang } = useI18n();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SosResult | null>(null);

  useEffect(() => {
    if (!user) {
      setContacts([]);
      return;
    }
    // Show the last-known contacts immediately (works offline), then refresh from the server.
    setContacts(offlineContacts.get<Contact>());
    api<{ contacts: Contact[] }>("/api/contacts")
      .then((res) => {
        setContacts(res.contacts);
        offlineContacts.set(res.contacts);
      })
      .catch(() => {});
  }, [user]);
  const online = useOnline();

  // Resume live sharing after a reload, so "I'm safe" is always reachable.
  const [liveShare, setLiveShare] = useState<LiveShare | null>(null);
  useEffect(() => {
    if (!user) return setLiveShare(null);
    api<{ share: LiveShare | null }>("/api/location-shares/active")
      .then((res) => setLiveShare((current) => current ?? res.share))
      .catch(() => {});
  }, [user]);
  const endLiveShare = useCallback(() => setLiveShare(null), []);

  const sendSOS = useCallback(async () => {
    setSending(true);
    setResult(null);
    const coords = await getLocation();
    try {
      const res = await api<SosResult>("/api/sos", { body: { coords } });
      setResult(res);
      if (res.share) setLiveShare(res.share);
    } catch (err) {
      setResult({
        deliveries: [],
        smsConfigured: false,
        message: fallbackMessage(t, user?.name, coords),
        serverError: (err as Error).message,
      });
    } finally {
      setSending(false);
    }
  }, [user, t]);

  // Upgrade "sent" to "delivered"/"answered" as Twilio reports back.
  const resultId = result?.id;
  const tracking = Boolean(result?.trackingDelivery && user);
  useEffect(() => {
    if (!resultId || !tracking) return;
    const started = Date.now();
    const timer = setInterval(async () => {
      if (Date.now() - started > POLL_DURATION_MS) return clearInterval(timer);
      try {
        const res = await api<{ deliveries: Delivery[] }>(`/api/sos/${resultId}`);
        setResult((prev) => (prev && prev.id === resultId ? { ...prev, deliveries: res.deliveries } : prev));
      } catch {
        // Keep showing the last known status.
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [resultId, tracking]);

  // Countdown gives a moment to cancel an accidental press.
  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      setCountdown(null);
      sendSOS();
      return;
    }
    const t = setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(t);
  }, [countdown, sendSOS]);

  const startCountdown = useCallback(() => {
    setCountdown((c) => (c === null ? COUNTDOWN_SECONDS : c));
  }, []);

  const voice = useVoiceTrigger({ lang, onTrigger: startCountdown });
  const shake = useShakeTrigger(startCountdown);
  const sosMode = useSosMode();
  // Holding is already deliberate, so a completed hold sends straight away.
  const hold = useHoldToSend(sendSOS, HOLD_SECONDS * 1000);
  const holdMode = sosMode.mode === "hold";
  const VOICE_ERRORS = {
    unsupported: isNative ? "sos.voiceUnsupportedApp" : "sos.voiceUnsupportedDesc",
    blocked: "sos.micBlockedDesc",
    noMic: "sos.voiceNoMic",
    network: "sos.voiceNetwork",
    other: "sos.voiceOther",
  } as const;

  const confirmedCount = contacts.filter((c) => c.status === "confirmed").length;
  const smsDeliveries = result?.deliveries.filter((d) => d.channel === "sms") ?? [];
  const sentCount = smsDeliveries.filter(smsReached).length;
  const deliveredAll = smsDeliveries.length > 0 && sentCount === smsDeliveries.length;
  const unconfirmedCount = smsDeliveries.filter((d) => d.status === "not_confirmed").length;
  // Contacts the user should text by hand: whoever the server didn't reach, or everyone
  // if the server couldn't be contacted at all.
  const fallbackContacts: Array<Pick<Contact, "name" | "phone">> = !result
    ? []
    : smsDeliveries.length > 0
      ? smsDeliveries.filter((d) => !smsReached(d))
      : contacts;

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <PageHeader
            icon={Siren}
            tone="danger"
            align="center"
            title={t("common.emergencySos")}
            subtitle={tr("sos.danger", {
              number: (
                <a href={`tel:${EMERGENCY_NUMBER}`} className="font-bold text-destructive underline underline-offset-2">
                  {EMERGENCY_NUMBER}
                </a>
              ),
            })}
          >
            {!online && (
              <p
                role="alert"
                className="rounded-md border border-destructive bg-destructive/10 px-4 py-3 text-sm text-foreground"
              >
                {t("sos.offline")}
              </p>
            )}
          </PageHeader>

          <Card className="mb-8 border-destructive/40">
            <CardContent className="p-6 sm:p-12 text-center space-y-8">
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  {user
                    ? confirmedCount > 0
                      ? tn("sos.status.confirmed", confirmedCount)
                      : contacts.length > 0
                        ? t("sos.status.noneConfirmed")
                        : t("sos.status.noContacts")
                    : t("sos.status.loggedOut")}
                </p>

                {/* Concentric rings frame the button; the countdown uses the same space so nothing jumps. */}
                <div className="mx-auto flex h-64 w-64 items-center justify-center rounded-full bg-destructive/5 sm:h-72 sm:w-72">
                  <div className="flex h-56 w-56 items-center justify-center rounded-full bg-destructive/10 sm:h-64 sm:w-64">
                    {countdown !== null ? (
                      <div className="relative flex h-48 w-48 flex-col items-center justify-center rounded-full bg-card sm:h-56 sm:w-56">
                        {/* A ring that empties over the countdown (a full ring for reduced motion). */}
                        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden>
                          <circle cx="50" cy="50" r="47" fill="none" strokeWidth="3" className="stroke-destructive/15" />
                          <circle
                            cx="50"
                            cy="50"
                            r="47"
                            fill="none"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeDasharray="295.3"
                            className="stroke-destructive motion-safe:[animation:countdown-ring_var(--countdown)_linear_forwards]"
                            style={{ "--ring-length": "295.3", "--countdown": `${COUNTDOWN_SECONDS}s` } as React.CSSProperties}
                          />
                        </svg>
                        <span className="text-7xl font-extrabold tabular-nums text-destructive" aria-live="assertive">
                          {countdown}
                        </span>
                        <span className="text-sm font-medium text-muted-foreground">{t("sos.sendingAlert")}</span>
                      </div>
                    ) : (
                      <div className="relative">
                        {hold.holding && (
                          // Fills over the hold time; letting go early cancels.
                          <svg viewBox="0 0 100 100" className="pointer-events-none absolute -inset-3 z-10 -rotate-90" aria-hidden>
                            <circle
                              cx="50"
                              cy="50"
                              r="48"
                              fill="none"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeDasharray="301.6"
                              className="sos-hold-ring stroke-destructive"
                              style={{ "--ring-length": "301.6", "--hold": `${HOLD_SECONDS}s` } as React.CSSProperties}
                            />
                          </svg>
                        )}
                        <Button
                          variant="emergency"
                          aria-label={sending ? t("sos.buttonSending") : holdMode ? t("sos.buttonHoldLabel") : t("sos.button")}
                          className={`h-48 w-48 touch-none select-none rounded-full p-0 sm:h-56 sm:w-56 ${sending ? "animate-pulse" : ""} ${hold.holding ? "scale-95" : ""}`}
                          onClick={holdMode ? undefined : startCountdown}
                          {...(holdMode ? hold.handlers : {})}
                          disabled={sending}
                        >
                          <span className="flex flex-col items-center gap-1.5">
                            <AlertCircle className="!size-12 sm:!size-14" />
                            <span className="text-5xl font-black tracking-wide sm:text-6xl">SOS</span>
                            <span className="max-w-[10rem] whitespace-normal text-center text-xs font-semibold leading-tight sm:text-sm">
                              {sending
                                ? t("sos.buttonSending")
                                : holdMode
                                  ? hold.holding
                                    ? t("sos.keepHolding")
                                    : t("sos.holdCaption", { seconds: HOLD_SECONDS })
                                  : t("sos.buttonCaption")}
                            </span>
                          </span>
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                {countdown !== null && (
                  <Button variant="outline" size="lg" className="min-w-40" onClick={() => setCountdown(null)}>
                    {t("common.cancel")}
                  </Button>
                )}
              </div>

              <div className="flex flex-col sm:flex-row justify-center gap-3">
                <a href={`tel:${EMERGENCY_NUMBER}`}>
                  <Button variant="emergency" size="lg" className="gap-2 w-full">
                    <Phone className="h-5 w-5" />
                    {t("common.call", { number: EMERGENCY_NUMBER })}
                  </Button>
                </a>
                <Button
                  variant="glass"
                  size="lg"
                  onClick={voice.status === "listening" ? voice.stop : voice.start}
                  className="h-auto min-h-11 gap-2 whitespace-normal py-2 text-center"
                  aria-pressed={voice.status === "listening"}
                >
                  {voice.status === "listening" ? <MicOff className="h-5 w-5 shrink-0" /> : <Mic className="h-5 w-5 shrink-0" />}
                  {voice.status === "listening" ? t("sos.voiceListening") : t("sos.voiceStart")}
                </Button>
              </div>
              {voice.status === "listening" && (
                <div className="space-y-1 text-xs text-muted-foreground" aria-live="polite">
                  <p>{t("sos.voiceHint")}</p>
                  <p className="font-medium text-foreground">
                    {voice.heard ? t("sos.voiceHeard", { text: voice.heard }) : t("sos.voiceWaiting")}
                  </p>
                  <p>{t("sos.voiceNote")}</p>
                </div>
              )}
              {voice.status === "error" && voice.error && (
                <p role="alert" className="text-sm text-destructive">
                  {t(VOICE_ERRORS[voice.error], { error: voice.errorDetail })}
                </p>
              )}
              <fieldset className="mx-auto max-w-md rounded-xl border bg-muted/40 p-3 text-left">
                <legend className="px-1 text-sm font-semibold">{t("sos.modeLabel")}</legend>
                <div className="grid grid-cols-2 gap-2" role="radiogroup">
                  {(["tap", "hold"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={sosMode.mode === m}
                      onClick={() => sosMode.setMode(m)}
                      className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                        sosMode.mode === m ? "border-primary bg-card font-semibold shadow-sm" : "border-transparent text-muted-foreground hover:bg-card"
                      }`}
                    >
                      {m === "tap" ? t("sos.modeTap") : t("sos.modeHold", { seconds: HOLD_SECONDS })}
                    </button>
                  ))}
                </div>
              </fieldset>
              {shake.supported && (
                <div className="mx-auto flex max-w-md items-start gap-3 rounded-xl border bg-muted/40 p-3 text-left">
                  <Vibrate className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <label htmlFor="shake-toggle" className="text-sm font-semibold">
                      {t("sos.shakeLabel")}
                    </label>
                    <p className="text-xs text-muted-foreground">{t("sos.shakeHint")}</p>
                  </div>
                  <Switch id="shake-toggle" checked={shake.enabled} onCheckedChange={shake.setEnabled} />
                </div>
              )}
            </CardContent>
          </Card>

          {liveShare && <LiveLocation share={liveShare} onEnded={endLiveShare} />}

          {/* Setup help comes after the button: in an emergency the button must be on screen first. */}
          {!liveShare && !result && <SetupChecklist className="mb-8" />}

          {result && (
            <Card className={`mb-8 ${deliveredAll ? "border-green-500/50" : "border-destructive"}`} aria-live="polite">
              <CardHeader>
                <CardTitle>
                  {deliveredAll
                    ? tn("sos.result.sent", sentCount)
                    : sentCount > 0
                      ? t("sos.result.partial", { sent: sentCount, total: smsDeliveries.length })
                      : t("sos.result.notSent")}
                </CardTitle>
                <CardDescription>
                  {result.serverError
                    ? t("sos.result.serverError", { error: result.serverError })
                    : smsDeliveries.length === 0
                      ? t("sos.result.noContacts")
                      : unconfirmedCount === smsDeliveries.length
                        ? t("sos.result.noneConfirmed")
                        : !result.smsConfigured
                          ? t("sos.result.smsNotSetUp")
                          : deliveredAll
                            ? t("sos.result.allSent")
                            : t("sos.result.someFailed")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {result.deliveries.map((d) => (
                  <div key={`${d.channel}-${d.phone}`} className="flex items-center gap-2 text-sm">
                    {["sent", "delivered", "answered"].includes(d.status) ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive shrink-0" />
                    )}
                    <span className="font-medium">{d.name}</span>
                    <span className="text-muted-foreground">{describe(d, Boolean(result.trackingDelivery), t)}</span>
                  </div>
                ))}
                {fallbackContacts.length > 0 && !deliveredAll && (
                  <div className="grid sm:grid-cols-2 gap-2 pt-2">
                    {fallbackContacts.map((c) => (
                      <div key={c.phone} className="flex gap-2">
                        <a href={smsLink(c.phone, result.message)} className="flex-1">
                          <Button variant="hero" className="w-full gap-2">
                            <MessageSquare className="h-4 w-4" /> {t("sos.textContact", { name: c.name })}
                          </Button>
                        </a>
                        <a href={`tel:${c.phone}`}>
                          <Button variant="outline" size="icon" aria-label={t("sos.callContact", { name: c.name })}>
                            <Phone className="h-4 w-4" />
                          </Button>
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <div className="mb-8 grid gap-4 md:grid-cols-2 md:gap-6">
            <div className="space-y-4">
              {[
                { to: "/timer", icon: Timer, title: t("timer.ctaTitle"), desc: t("timer.ctaDesc"), cta: t("timer.ctaButton") },
                { to: "/walk", icon: Footprints, title: t("walk.ctaTitle"), desc: t("walk.ctaDesc"), cta: t("walk.ctaButton") },
              ].map(({ to, icon: Icon, title, desc, cta }) => (
                <Link
                  key={to}
                  to={to}
                  aria-label={cta}
                  className="group flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/40"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-6 w-6" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{title}</span>
                    <span className="block text-sm text-muted-foreground">{desc}</span>
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              ))}
              <Link
                to={user ? "/contacts" : "/login?next=/contacts"}
                className="group flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/40"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Users className="h-6 w-6" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{user ? t("sos.contacts.manage") : t("sos.contacts.logIn")}</span>
                  <span className="block text-sm text-muted-foreground">
                    {user ? t("sos.contacts.count", { confirmed: confirmedCount, total: contacts.length }) : t("sos.contacts.desc")}
                  </span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
            <FakeCall />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("sos.howTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-5 md:grid-cols-3">
                {[
                  { icon: MessageSquare, title: t("sos.card.smsTitle"), desc: t("sos.card.smsDesc") },
                  { icon: MapPin, title: t("sos.card.locationTitle"), desc: t("sos.card.locationDesc") },
                  { icon: Phone, title: t("sos.card.servicesTitle"), desc: t("sos.card.servicesDesc", { number: EMERGENCY_NUMBER }) },
                ].map(({ icon: Icon, title, desc }) => (
                  <li key={title} className="flex gap-3">
                    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <div>
                      <p className="font-semibold">{title}</p>
                      <p className="text-sm text-muted-foreground">{desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default SOS;
