import { AudioLines } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/i18n";
import type { MessageKey } from "@/i18n/en";
import type { useScreamTrigger } from "@/hooks/use-scream-trigger";
import { cn } from "@/lib/utils";

const STATUS: Record<string, MessageKey | null> = {
  off: null,
  starting: "scream.starting",
  listening: "scream.listening",
  needsTap: "scream.needsTap",
  denied: "scream.denied",
  unsupported: "scream.unsupported",
  error: "scream.error",
};

// The SOS page's "listen for screams" option, with a test that never starts SOS.
const ScreamSettings = ({ scream }: { scream: ReturnType<typeof useScreamTrigger> }) => {
  const { t } = useI18n();
  if (!scream.supported) return null;
  const status = STATUS[scream.status];
  return (
    <div className="mx-auto max-w-md space-y-3 rounded-xl border bg-muted/40 p-3 text-left">
      <div className="flex items-start gap-3">
        <AudioLines className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <label htmlFor="scream-toggle" className="text-sm font-semibold">
            {t("scream.label")}
          </label>
          <p className="text-xs text-muted-foreground">{t("scream.hint")}</p>
        </div>
        <Switch id="scream-toggle" checked={scream.enabled} onCheckedChange={scream.setEnabled} />
      </div>
      {(scream.enabled || scream.testing) && (
        <div className="space-y-3 pl-8">
          {status && (
            <p
              role="status"
              className={cn(
                "text-xs font-semibold",
                scream.status === "listening" ? "text-success" : scream.status === "starting" ? "" : "text-destructive",
              )}
            >
              {t(status)}
            </p>
          )}
          <div className="inline-flex rounded-full bg-muted p-1" role="group" aria-label={t("scream.sensitivity")}>
            {(["normal", "high"] as const).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={scream.sensitivity === s}
                onClick={() => scream.setSensitivity(s)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold",
                  scream.sensitivity === s ? "bg-card shadow-sm" : "text-muted-foreground",
                )}
              >
                {s === "normal" ? t("scream.normal") : t("scream.high")}
              </button>
            ))}
          </div>
          {scream.testing ? (
            <div className="space-y-2">
              <p className="text-xs">{t("scream.testHint")}</p>
              <div className="h-3 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <div
                  className={cn("h-full rounded-full transition-[width] duration-75", scream.screamy ? "bg-destructive" : "bg-primary")}
                  style={{ width: `${Math.round(scream.level * 100)}%` }}
                />
              </div>
              <p role="status" className="text-xs font-semibold">
                {scream.heardInTest ? t("scream.wouldTrigger") : scream.screamy ? t("scream.counting") : t("scream.notYet")}
              </p>
              <Button type="button" variant="outline" size="sm" onClick={scream.stopTest}>
                {t("scream.stopTest")}
              </Button>
            </div>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={scream.startTest}>
              {t("scream.test")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default ScreamSettings;
