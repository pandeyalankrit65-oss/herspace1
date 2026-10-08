import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HeartHandshake, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { speechLocale, useI18n } from "@/i18n";
import type { MessageKey } from "@/i18n/en";
import { useVoiceTrigger } from "@/hooks/use-voice-trigger";
import { Companion, type CompanionEvent } from "@/lib/companion";
import { vibrate } from "@/lib/disguise";
import { speak, stopSpeaking } from "@/lib/speak";

const ASKS: MessageKey[] = ["stay.ask1", "stay.ask2", "stay.ask3"];

// "Stay with me" during a journey: a calm voice through her earphones checks on her every few
// minutes, like a friend on the phone. A tap or saying anything answers. Two checks without an
// answer send a silent SOS (contacts are told she stopped answering). Talking back also makes
// it look like she's on a call.
const StayWithMe = ({ name }: { name: string }) => {
  const { t, tn, lang } = useI18n();
  const navigate = useNavigate();
  const [on, setOn] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const companion = useRef<Companion | null>(null);
  const askCount = useRef(0);

  // Any words she says answer the check; "help" goes to the SOS countdown as usual.
  const answeredRef = useRef<() => void>(() => {});
  const voice = useVoiceTrigger({
    lang,
    onTrigger: () => navigate("/sos?start=sos"),
    onHeard: () => answeredRef.current(),
  });
  const { start: startListening, stop: stopListening } = voice;

  const say = useCallback(
    async (text: string) => {
      stopListening();
      await speak(text, speechLocale(lang)).catch(() => {});
    },
    [lang, stopListening]
  );

  const answered = useCallback(() => {
    const c = companion.current;
    if (!c?.waiting) return;
    c.answered();
    setWaiting(false);
    stopListening();
    void say(t("stay.ok"));
  }, [say, stopListening, t]);
  answeredRef.current = answered;

  const handle = useCallback(
    async (event: CompanionEvent) => {
      if (event === "alert") {
        stopListening();
        setOn(false);
        navigate("/sos", { state: { autoSos: "stopped_answering" } });
        return;
      }
      setWaiting(true);
      vibrate(event === "ask" ? [300] : [400, 200, 400]);
      const text = event === "ask" ? t(ASKS[askCount.current++ % ASKS.length], { name }) : t("stay.askAgain", { name });
      // Listen only after speaking, so the phone doesn't hear itself through the speaker.
      await say(text);
      if (companion.current?.waiting) void startListening();
    },
    [name, navigate, say, startListening, stopListening, t]
  );

  useEffect(() => {
    if (!on) return;
    const timer = setInterval(() => {
      const c = companion.current;
      if (!c) return;
      const event = c.tick();
      if (event) void handle(event);
      setSecondsLeft(c.secondsLeft());
    }, 1000);
    return () => clearInterval(timer);
  }, [on, handle]);

  const start = () => {
    companion.current = new Companion();
    askCount.current = 0;
    setOn(true);
    setWaiting(false);
    void say(t("stay.hello", { name }));
  };

  const stop = () => {
    companion.current = null;
    setOn(false);
    setWaiting(false);
    stopListening();
    stopSpeaking();
  };

  useEffect(() => () => stopSpeaking(), []);

  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <HeartHandshake className="h-4 w-4 text-primary" /> {t("stay.label")}
          </p>
          <p className="text-xs text-muted-foreground">{on ? t("stay.status") : t("stay.hint")}</p>
        </div>
        <Button type="button" variant={on ? "outline" : "hero"} size="sm" onClick={on ? stop : start}>
          {on ? t("stay.stop") : t("stay.start")}
        </Button>
      </div>
      {on && waiting && (
        <div role="alertdialog" aria-labelledby="stay-ask" className="space-y-2 rounded-lg bg-primary/5 p-3">
          <p id="stay-ask" className="font-semibold">
            {tn("stay.waiting", secondsLeft)}
          </p>
          {voice.status === "listening" && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Mic className="h-3.5 w-3.5" /> {t("stay.listening")}
            </p>
          )}
          <Button type="button" variant="hero" size="lg" className="w-full" onClick={answered}>
            {t("stay.okay")}
          </Button>
        </div>
      )}
    </div>
  );
};

export default StayWithMe;
