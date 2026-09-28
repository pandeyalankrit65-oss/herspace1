import { useEffect, useRef, useState } from "react";
import { Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";

// A siren and a flashing screen, for when drawing attention is the safest thing to do.
// The screen alternates at under 3 flashes a second (the safe limit for photosensitive seizures).
const LoudAlarm = () => {
  const { t } = useI18n();
  const [on, setOn] = useState(false);
  const audio = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!on) return;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    audio.current = ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    gain.gain.value = 1;
    osc.connect(gain).connect(ctx.destination);
    // Sweep 700 -> 1600 Hz twice a second: the classic, hard-to-ignore siren.
    const sweep = () => {
      const now = ctx.currentTime;
      for (let i = 0; i < 8; i++) {
        osc.frequency.setValueAtTime(700, now + i * 0.5);
        osc.frequency.linearRampToValueAtTime(1600, now + i * 0.5 + 0.45);
      }
    };
    sweep();
    const timer = window.setInterval(sweep, 4000);
    osc.start();
    navigator.vibrate?.([500, 200, 500, 200, 500, 200, 500]);
    return () => {
      window.clearInterval(timer);
      osc.stop();
      ctx.close().catch(() => {});
      navigator.vibrate?.(0);
    };
  }, [on]);

  useEffect(() => {
    if (!on) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOn(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [on]);

  return (
    <>
      <Button variant="outline" size="lg" className="gap-2" onClick={() => setOn(true)}>
        <Megaphone className="h-5 w-5" /> {t("alarm.button")}
      </Button>
      {on && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-label={t("alarm.playing")}
          className="alarm-flash fixed inset-0 z-[100] flex flex-col items-center justify-center gap-8 p-6"
        >
          <p className="text-center text-5xl font-black tracking-wide text-white drop-shadow-lg sm:text-7xl">{t("alarm.help")}</p>
          <Button size="xl" className="bg-white text-lg font-bold text-black hover:bg-white/90" onClick={() => setOn(false)} autoFocus>
            {t("alarm.stop")}
          </Button>
        </div>
      )}
    </>
  );
};

export default LoudAlarm;
