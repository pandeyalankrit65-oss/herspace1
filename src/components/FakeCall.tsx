import { useCallback, useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, User, MicOff, Grid3x3, Volume2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { speechLocale, useI18n } from "@/i18n";
import { canSpeak, speak, stopSpeaking } from "@/lib/speak";
import { useVoiceTrigger } from "@/hooks/use-voice-trigger";

const DELAYS = [0, 10, 30, 60];

// A ringing tone made with the Web Audio API (two-tone ring, like a phone), so no audio file is needed.
function startRingtone(): () => void {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return () => {};
  const ctx = new Ctx();
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.connect(ctx.destination);
  for (const freq of [440, 480]) {
    const osc = ctx.createOscillator();
    osc.frequency.value = freq;
    osc.connect(gain);
    osc.start();
  }
  // 2 seconds on, 4 seconds off.
  const ring = () => {
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.setValueAtTime(0, t + 2);
  };
  ring();
  const timer = window.setInterval(ring, 6000);
  return () => {
    window.clearInterval(timer);
    ctx.close().catch(() => {});
  };
}

type Phase = "idle" | "waiting" | "ringing" | "onCall";
type Turn = { role: "user" | "assistant"; content: string };

// Her turn ends after this long without new words.
const END_OF_TURN_MS = 1200;

// Shows a realistic incoming call as an excuse to leave an uncomfortable situation.
// ringSignal: a new value rings straight away (the "fake call" voice command).
// voiceBusy: the page's voice trigger is listening; browsers allow one listener, so the caller
// then sticks to its script instead of talking back.
const FakeCall = ({ ringSignal, voiceBusy = false }: { ringSignal?: number; voiceBusy?: boolean }) => {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [caller, setCaller] = useState("");
  const [delay, setDelay] = useState(10);
  const [phase, setPhase] = useState<Phase>("idle");
  useEffect(() => {
    if (ringSignal) setPhase("ringing");
  }, [ringSignal]);
  const [waitLeft, setWaitLeft] = useState(0);
  const [callSeconds, setCallSeconds] = useState(0);
  const stopRing = useRef<() => void>(() => {});
  const name = caller.trim() || t("fakeCall.defaultCaller");

  // Countdown to the ring.
  useEffect(() => {
    if (phase !== "waiting") return;
    if (waitLeft <= 0) {
      setPhase("ringing");
      return;
    }
    const timer = window.setTimeout(() => setWaitLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [phase, waitLeft]);

  // Ring and vibrate until answered or declined.
  useEffect(() => {
    if (phase !== "ringing") return;
    stopRing.current = startRingtone();
    navigator.vibrate?.([1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000]);
    return () => {
      stopRing.current();
      navigator.vibrate?.(0);
    };
  }, [phase]);

  // The caller talks back: after each line it listens, and answers what she says (AI on the
  // server, or scripted lines without it). "Help" isn't a trigger here: people say it on calls.
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const turns = useRef<Turn[]>([]);
  const heardRef = useRef("");
  const turnTimer = useRef<number>();
  const listenRef = useRef<() => void>(() => {});
  const voice = useVoiceTrigger({
    lang,
    onTrigger: () => {},
    helpWords: false,
    onHeard: (text) => {
      heardRef.current = text;
      window.clearTimeout(turnTimer.current);
      turnTimer.current = window.setTimeout(() => void herTurn(), END_OF_TURN_MS);
    },
  });
  const { start: startListening, stop: stopListening } = voice;
  const canTalkBack = canSpeak && voice.supported && !voiceBusy;

  const callerSays = useCallback(
    async (text: string) => {
      turns.current.push({ role: "assistant", content: text });
      await speak(text, speechLocale(lang)).catch(() => {});
      // Listen only after speaking, so the phone doesn't hear the caller as her.
      if (phaseRef.current === "onCall") listenRef.current();
    },
    [lang]
  );

  const herTurn = async () => {
    const said = heardRef.current.trim();
    heardRef.current = "";
    if (!said || phaseRef.current !== "onCall") return;
    stopListening();
    turns.current.push({ role: "user", content: said });
    try {
      const res = await api<{ reply: string }>("/api/fake-call/reply", { body: { messages: turns.current.slice(-20), caller: name, lang } });
      if (phaseRef.current === "onCall") await callerSays(res.reply);
    } catch {
      if (phaseRef.current === "onCall") listenRef.current();
    }
  };

  useEffect(() => {
    listenRef.current = canTalkBack ? startListening : () => {};
  }, [canTalkBack, startListening]);

  // Once answered, a voice speaks from the phone, so the call sounds real to people nearby.
  useEffect(() => {
    if (phase !== "onCall" || !canSpeak) return;
    turns.current = [];
    const timer = window.setTimeout(() => void callerSays(t("fakeCall.script")), 1200);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(turnTimer.current);
      stopListening();
      stopSpeaking();
    };
  }, [phase, t, callerSays, stopListening]);

  // "Keypad" on the call screen sends a silent SOS without anything visible changing.
  const [sosSent, setSosSent] = useState(false);
  const silentSos = () => {
    if (sosSent || !user) return;
    setSosSent(true);
    navigator.geolocation?.getCurrentPosition(
      (p) => api("/api/sos", { body: { coords: { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }, silent: true } }).catch(() => {}),
      () => api("/api/sos", { body: { silent: true } }).catch(() => {}),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 }
    );
  };

  useEffect(() => {
    if (phase !== "onCall") return;
    setSosSent(false);
    setCallSeconds(0);
    const timer = window.setInterval(() => setCallSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  const schedule = () => {
    setWaitLeft(delay);
    setPhase(delay === 0 ? "ringing" : "waiting");
  };

  const overlay = phase === "ringing" || phase === "onCall";

  return (
    <>
      <Card id="fake-call" className="scroll-mt-24">
        <CardHeader>
          <Phone className="h-8 w-8 text-primary mb-2" />
          <CardTitle className="text-lg">{t("fakeCall.title")}</CardTitle>
          <CardDescription>
            {t("fakeCall.desc")} {canTalkBack && t("fakeCall.talkBack")} {user && t("fakeCall.keypadHint")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {phase === "waiting" ? (
            <div className="space-y-2">
              <p className="text-sm" aria-live="polite">
                {t("fakeCall.scheduled", { count: waitLeft })}
              </p>
              <Button variant="outline" className="w-full" onClick={() => setPhase("idle")}>
                {t("common.cancel")}
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <Label htmlFor="fake-caller">{t("fakeCall.caller")}</Label>
                <Input
                  id="fake-caller"
                  value={caller}
                  maxLength={40}
                  placeholder={t("fakeCall.defaultCaller")}
                  onChange={(e) => setCaller(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">{t("fakeCall.delay")}</p>
                <div className="grid grid-cols-4 gap-2">
                  {DELAYS.map((d) => (
                    <Button
                      key={d}
                      type="button"
                      size="sm"
                      variant={delay === d ? "hero" : "outline"}
                      aria-pressed={delay === d}
                      onClick={() => setDelay(d)}
                    >
                      {d === 0 ? t("fakeCall.now") : t("fakeCall.seconds", { count: d })}
                    </Button>
                  ))}
                </div>
              </div>
              <Button variant="hero" className="w-full" onClick={schedule}>
                {t("fakeCall.schedule")}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {overlay && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("fakeCall.incoming")}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-between bg-gradient-to-b from-slate-900 via-slate-950 to-black px-6 py-16 text-white"
        >
          <div className="text-center space-y-3">
            <p className="text-sm uppercase tracking-widest text-white/60">
              {phase === "ringing" ? t("fakeCall.incoming") : formatDuration(callSeconds)}
            </p>
            <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-white/10">
              <User className="h-14 w-14 text-white/80" />
            </div>
            <p className="text-4xl font-semibold">{name}</p>
            <p className="text-white/60">{t("fakeCall.mobile")}</p>
          </div>
          <div className="w-full max-w-xs space-y-6">
            {phase === "ringing" ? (
              <div className="flex justify-between">
                <CallButton
                  label={t("fakeCall.decline")}
                  color="bg-red-600"
                  onClick={() => setPhase("idle")}
                  icon={<PhoneOff className="h-8 w-8" />}
                />
                <CallButton
                  label={t("fakeCall.accept")}
                  color="bg-green-600 animate-pulse"
                  onClick={() => setPhase("onCall")}
                  icon={<Phone className="h-8 w-8" />}
                />
              </div>
            ) : (
              <div className="space-y-8">
                <div className="grid grid-cols-3 gap-6 text-center text-xs text-white/70">
                  {[
                    { key: "mute", icon: <MicOff className="h-6 w-6" />, onClick: undefined },
                    { key: "keypad", icon: <Grid3x3 className="h-6 w-6" />, onClick: silentSos },
                    { key: "speaker", icon: <Volume2 className="h-6 w-6" />, onClick: undefined },
                  ].map((b) => (
                    <button key={b.key} type="button" onClick={b.onClick} className="flex flex-col items-center gap-2">
                      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10">{b.icon}</span>
                      {t(`fakeCall.${b.key}` as "fakeCall.mute")}
                    </button>
                  ))}
                </div>
              <div className="flex justify-center">
                <CallButton
                  label={t("fakeCall.end")}
                  color="bg-red-600"
                  onClick={() => setPhase("idle")}
                  icon={<PhoneOff className="h-8 w-8" />}
                />
              </div>
              </div>
            )}
            <p className="text-center text-xs text-white/40">{t("fakeCall.disclaimer")}</p>
          </div>
        </div>
      )}
    </>
  );
};

const formatDuration = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

const CallButton = ({
  label,
  color,
  icon,
  onClick,
}: {
  label: string;
  color: string;
  icon: React.ReactNode;
  onClick: () => void;
}) => (
  <div className="flex flex-col items-center gap-2">
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`flex h-16 w-16 items-center justify-center rounded-full ${color}`}
    >
      {icon}
    </button>
    <span className="text-sm text-white/80">{label}</span>
  </div>
);

export default FakeCall;
