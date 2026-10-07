import { useState } from "react";
import { Ear, Eye, Flower2, Hand, Leaf, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import type { MessageKey } from "@/i18n/en";

// 5-4-3-2-1: naming things around you brings attention back to the present during panic.
const STEPS: Array<{ count: number; icon: typeof Eye; text: MessageKey }> = [
  { count: 5, icon: Eye, text: "wb.g5" },
  { count: 4, icon: Hand, text: "wb.g4" },
  { count: 3, icon: Ear, text: "wb.g3" },
  { count: 2, icon: Flower2, text: "wb.g2" },
  { count: 1, icon: Leaf, text: "wb.g1" },
];

const Grounding = () => {
  const { t } = useI18n();
  const [step, setStep] = useState(-1);
  const done = step >= STEPS.length;
  const current = STEPS[step];

  return (
    <section aria-labelledby="ground-title" className="flex flex-col gap-5 rounded-[2rem] bg-card p-6 shadow-card ring-1 ring-border sm:p-8">
      <div>
        <h2 id="ground-title" className="text-2xl font-extrabold">
          {t("wb.groundTitle")}
        </h2>
        <p className="text-muted-foreground">{t("wb.groundText")}</p>
      </div>
      <div className="flex min-h-[9rem] flex-1 flex-col items-center justify-center gap-3 rounded-3xl bg-muted/50 p-6 text-center" aria-live="polite">
        {step < 0 ? (
          <p className="text-muted-foreground">{t("wb.groundIntro")}</p>
        ) : done ? (
          <>
            <Sparkles className="h-8 w-8 text-primary" />
            <p className="text-lg font-bold">{t("wb.groundDone")}</p>
          </>
        ) : (
          <>
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-2xl font-extrabold text-primary-foreground">
              {current.count}
            </span>
            <current.icon className="h-6 w-6 text-primary" />
            <p className="text-lg font-bold">{t(current.text)}</p>
          </>
        )}
      </div>
      {step >= 0 && !done && (
        <ol className="flex justify-center gap-2" aria-hidden="true">
          {STEPS.map((s, i) => (
            <li key={s.count} className={`h-2 w-8 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </ol>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        {step < 0 || done ? (
          <Button type="button" variant="hero" className="gap-2" onClick={() => setStep(0)}>
            {done && <RotateCcw className="h-4 w-4" />}
            {done ? t("wb.again") : t("wb.begin")}
          </Button>
        ) : (
          <>
            <Button type="button" variant="ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
              {t("wb.back")}
            </Button>
            <Button type="button" variant="hero" onClick={() => setStep((s) => s + 1)}>
              {t("wb.next")}
            </Button>
          </>
        )}
      </div>
    </section>
  );
};

export default Grounding;
