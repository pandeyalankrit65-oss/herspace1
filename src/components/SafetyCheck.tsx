import { useEffect } from "react";
import { ShieldAlert, ShieldQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/i18n";
import type { MessageKey } from "@/i18n/en";
import { useScreamTrigger } from "@/hooks/use-scream-trigger";
import { useVoiceStress } from "@/hooks/use-voice-stress";
import type { SafetyCheckState } from "@/hooks/use-safety-check";
import type { Clue } from "@/lib/safetyCheck";

const REASON: Record<Clue, MessageKey> = {
  scream: "check.why.scream",
  stress: "check.why.stress",
  running: "check.why.running",
  risky_area: "check.why.area",
  risky_area_dark: "check.why.areaDark",
  long_stop: "check.why.stop",
};

export const SafetyCheckToggle = ({ on, setOn }: { on: boolean; setOn: (on: boolean) => void }) => {
  const { t } = useI18n();
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border p-4">
      <div className="space-y-1">
        <label htmlFor="safety-check-toggle" className="flex items-center gap-2 text-sm font-semibold">
          <ShieldQuestion className="h-4 w-4 text-primary" /> {t("check.label")}
        </label>
        <p className="text-xs text-muted-foreground">{t("check.hint")}</p>
      </div>
      <Switch id="safety-check-toggle" checked={on} onCheckedChange={setOn} />
    </div>
  );
};

// A scream or a stressed voice, only if she turned those on (SOS page). Each is one clue here: it
// doesn't start SOS or ask by itself on a journey unless the clues add up.
export const MicClues = ({ onClue }: { onClue: (clue: Clue) => void }) => {
  useScreamTrigger(() => onClue("scream"));
  const stress = useVoiceStress();
  const { asked, dismiss } = stress;
  useEffect(() => {
    if (!asked) return;
    onClue("stress");
    dismiss();
  }, [asked, dismiss, onClue]);
  return null;
};

// "Are you okay?" Big buttons, a visible countdown, and what made it ask.
export const SafetyCheckPrompt = ({ check }: { check: SafetyCheckState }) => {
  const { t, tn } = useI18n();
  if (!check.asking) return null;
  return (
    <div
      role="alertdialog"
      aria-labelledby="check-title"
      aria-describedby="check-text"
      className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-md space-y-3 rounded-2xl bg-card p-5 shadow-raised ring-2 ring-destructive/60"
    >
      <p id="check-title" className="text-xl font-extrabold">
        {t("check.title")}
      </p>
      <p id="check-text" className="text-sm">
        {tn("check.countdown", check.secondsLeft)}
      </p>
      <p className="text-xs text-muted-foreground">
        {t("check.why")} {check.asking.reasons.map((r) => t(REASON[r])).join(", ")}.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button type="button" variant="hero" size="lg" onClick={check.okay}>
          {t("check.okay")}
        </Button>
        <Button type="button" variant="destructive" size="lg" className="gap-2" onClick={check.sendNow}>
          <ShieldAlert className="h-5 w-5" /> {t("check.sos")}
        </Button>
      </div>
    </div>
  );
};
