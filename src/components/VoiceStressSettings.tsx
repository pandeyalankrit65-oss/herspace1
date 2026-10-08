import { Link } from "react-router-dom";
import { Activity, Phone, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/i18n";
import type { MessageKey } from "@/i18n/en";
import type { useVoiceStress } from "@/hooks/use-voice-stress";
import { cn } from "@/lib/utils";

const STATUS: Record<string, MessageKey | null> = {
  off: null,
  starting: "stress.starting",
  listening: "stress.listening",
  needsTap: "scream.needsTap",
  denied: "scream.denied",
  unsupported: "stress.unsupported",
  error: "scream.error",
};

type Stress = ReturnType<typeof useVoiceStress>;

// "You sound stressed. Are you okay?" Fixed above the bottom bar so it's seen wherever she is
// on the page. It offers SOS; it never starts it.
export const StressPrompt = ({ stress, onSos }: { stress: Stress; onSos: () => void }) => {
  const { t } = useI18n();
  if (!stress.asked) return null;
  return (
    <div
      role="alertdialog"
      aria-labelledby="stress-title"
      className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-md space-y-3 rounded-2xl bg-card p-4 shadow-raised ring-1 ring-border"
    >
      <p id="stress-title" className="font-bold">
        {t("stress.askTitle")}
      </p>
      <p className="text-sm text-muted-foreground">{t("stress.askText")}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={stress.dismiss}>
          {t("stress.okay")}
        </Button>
        <Button
          type="button"
          variant="destructive"
          className="gap-2"
          onClick={() => {
            stress.dismiss();
            onSos();
          }}
        >
          <ShieldAlert className="h-4 w-4" /> {t("stress.sos")}
        </Button>
        <Link
          to="/sos#fake-call"
          onClick={stress.dismiss}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold hover:bg-muted"
        >
          <Phone className="h-4 w-4" /> {t("emotion.fakeCall")}
        </Link>
      </div>
    </div>
  );
};

// The opt-in experiment on the SOS page: calibrate to her calm voice, then listen.
const VoiceStressSettings = ({ stress }: { stress: Stress }) => {
  const { t } = useI18n();
  if (!stress.supported) return null;
  const status = STATUS[stress.status];
  return (
    <div className="mx-auto max-w-md space-y-3 rounded-xl border bg-muted/40 p-3 text-left">
      <div className="flex items-start gap-3">
        <Activity className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <label htmlFor="stress-toggle" className="text-sm font-semibold">
            {t("stress.label")}{" "}
            <span className="ml-1 rounded-full bg-warning/20 px-2 py-0.5 text-[11px] font-bold uppercase">{t("stress.experimental")}</span>
          </label>
          <p className="text-xs text-muted-foreground">{t("stress.hint")}</p>
        </div>
        <Switch id="stress-toggle" checked={stress.enabled} onCheckedChange={stress.setEnabled} />
      </div>
      {stress.enabled && (
        <div className="space-y-2 pl-8">
          {stress.calibrating ? (
            <>
              <p className="text-xs font-semibold">{t("stress.calibratingText")}</p>
              <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${Math.round(stress.progress * 100)}%` }} />
              </div>
            </>
          ) : !stress.baseline ? (
            <>
              <p className="text-xs">{t("stress.needBaseline")}</p>
              {stress.calibrationFailed && (
                <p role="alert" className="text-xs text-destructive">
                  {t("stress.calibrationFailed")}
                </p>
              )}
              <Button type="button" size="sm" variant="outline" onClick={stress.calibrate}>
                {t("stress.calibrate")}
              </Button>
            </>
          ) : (
            <>
              {status && (
                <p
                  role="status"
                  className={cn(
                    "text-xs font-semibold",
                    stress.status === "listening" ? "text-success" : stress.status === "starting" ? "" : "text-destructive",
                  )}
                >
                  {t(status)}
                </p>
              )}
              <button type="button" onClick={stress.calibrate} className="text-xs font-semibold text-primary underline underline-offset-2">
                {t("stress.recalibrate")}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default VoiceStressSettings;
