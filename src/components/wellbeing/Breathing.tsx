import { useEffect, useState } from "react";
import { Pause, Play, Wind } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/i18n";
import type { MessageKey } from "@/i18n/en";
import { cn } from "@/lib/utils";

type Phase = { label: MessageKey; seconds: number; scale: number };

// Box breathing (4-4-4-4) steadies quickly; 4-7-8 is slower and helps before sleep.
const PATTERNS: Record<"box" | "slow", Phase[]> = {
  box: [
    { label: "wb.in", seconds: 4, scale: 1 },
    { label: "wb.hold", seconds: 4, scale: 1 },
    { label: "wb.out", seconds: 4, scale: 0.55 },
    { label: "wb.hold", seconds: 4, scale: 0.55 },
  ],
  slow: [
    { label: "wb.in", seconds: 4, scale: 1 },
    { label: "wb.hold", seconds: 7, scale: 1 },
    { label: "wb.out", seconds: 8, scale: 0.55 },
  ],
};

const Breathing = () => {
  const { t, tn } = useI18n();
  const [pattern, setPattern] = useState<"box" | "slow">("box");
  const [running, setRunning] = useState(false);
  // One state object, advanced by a pure update, so a phase change is never applied twice.
  const [tick, setTick] = useState({ phase: 0, left: PATTERNS.box[0].seconds, rounds: 0 });
  const [vibrate, setVibrate] = useState(false);
  const canVibrate = typeof navigator !== "undefined" && "vibrate" in navigator;
  const steps = PATTERNS[pattern];
  const { phase, left, rounds } = tick;

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(
      () =>
        setTick((prev) => {
          if (prev.left > 1) return { ...prev, left: prev.left - 1 };
          const next = (prev.phase + 1) % steps.length;
          return { phase: next, left: steps[next].seconds, rounds: prev.rounds + (next === 0 ? 1 : 0) };
        }),
      1000,
    );
    return () => window.clearInterval(id);
  }, [running, steps]);

  // A longer buzz to breathe in, a short one for the other steps.
  useEffect(() => {
    if (running && vibrate) navigator.vibrate?.(steps[phase].label === "wb.in" ? 120 : 40);
  }, [phase, running, vibrate, steps]);

  const start = () => {
    setTick({ phase: 0, left: steps[0].seconds, rounds: 0 });
    setRunning(true);
  };
  const choose = (p: "box" | "slow") => {
    setRunning(false);
    setPattern(p);
    setTick({ phase: 0, left: PATTERNS[p][0].seconds, rounds: 0 });
  };

  const current = steps[phase];
  return (
    <section aria-labelledby="breathe-title" className="space-y-5 rounded-[2rem] bg-card p-6 shadow-card ring-1 ring-border sm:p-8">
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-brand text-white shadow-raised">
          <Wind className="h-6 w-6" />
        </span>
        <div>
          <h2 id="breathe-title" className="text-2xl font-extrabold">
            {t("wb.breatheTitle")}
          </h2>
          <p className="text-muted-foreground">{t("wb.breatheText")}</p>
        </div>
      </div>

      <div className="inline-flex rounded-full bg-muted p-1" role="group" aria-label={t("wb.pattern")}>
        {(["box", "slow"] as const).map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={pattern === p}
            onClick={() => choose(p)}
            className={cn("rounded-full px-4 py-1.5 text-sm font-semibold", pattern === p ? "bg-card shadow-sm" : "text-muted-foreground")}
          >
            {p === "box" ? t("wb.box") : t("wb.slow")}
          </button>
        ))}
      </div>

      <div className="flex flex-col items-center gap-4 py-2">
        <div className="relative flex h-56 w-56 items-center justify-center">
          <div
            aria-hidden="true"
            className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/30 to-brand/30 transition-transform ease-in-out motion-reduce:transition-none"
            style={{ transform: `scale(${running ? current.scale : 0.7})`, transitionDuration: `${current.seconds}s` }}
          />
          <div className="relative text-center">
            <p className="text-2xl font-extrabold" aria-live="polite">
              {running ? t(current.label) : t("wb.ready")}
            </p>
            {running && <p className="text-4xl font-extrabold tabular-nums">{left}</p>}
          </div>
        </div>
        {rounds > 0 && <p className="text-sm text-muted-foreground">{tn("wb.rounds", rounds)}</p>}
        <Button type="button" variant="hero" size="lg" className="gap-2" onClick={running ? () => setRunning(false) : start}>
          {running ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          {running ? t("wb.stop") : t("wb.start")}
        </Button>
        {canVibrate && (
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={vibrate} onCheckedChange={setVibrate} /> {t("wb.vibrate")}
          </label>
        )}
      </div>
    </section>
  );
};

export default Breathing;
