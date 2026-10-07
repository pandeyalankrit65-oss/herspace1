import { Link } from "react-router-dom";
import { Phone, ShieldAlert, TriangleAlert, X } from "lucide-react";
import { useI18n } from "@/i18n";
import type { MessageKey } from "@/i18n/en";
import type { AreaWarning as Warning } from "@/lib/risk";

const TYPE_LABEL: Record<string, MessageKey> = {
  harassment: "report.types.harassment",
  assault: "report.types.assault",
  stalking: "report.types.stalking",
  threat: "report.types.threat",
  discrimination: "report.types.discrimination",
  other: "report.types.other",
};

// Shown during a journey on entering a ~1 km square with several recent reports: what has
// been reported there, and quick ways out.
const AreaWarning = ({ warning, onDismiss }: { warning: Warning; onDismiss: () => void }) => {
  const { t } = useI18n();
  return (
    <div role="alert" className="relative space-y-2 rounded-xl border border-warning/60 bg-warning/10 p-3 pr-9">
      <p className="flex items-start gap-2 font-semibold">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
        {t(warning.level === 3 ? "areaWarn.titleMany" : "areaWarn.titleSeveral", { count: warning.count })}
      </p>
      <p className="text-sm">
        {warning.topType && t("areaWarn.mostly", { type: t(TYPE_LABEL[warning.topType] ?? "report.types.other") })}
        {warning.timeOfDay === "night" && <> {t("areaWarn.night")}</>}
        {warning.timeOfDay === "day" && <> {t("areaWarn.day")}</>} {t("areaWarn.tips")}
      </p>
      <div className="flex flex-wrap gap-2">
        <Link
          to="/sos#fake-call"
          className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-sm font-semibold ring-1 ring-border hover:bg-muted"
        >
          <Phone className="h-4 w-4" /> {t("areaWarn.fakeCall")}
        </Link>
        <Link
          to="/sos?start=sos"
          className="inline-flex items-center gap-1.5 rounded-full bg-destructive px-3 py-1.5 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90"
        >
          <ShieldAlert className="h-4 w-4" /> {t("distress.sos")}
        </Link>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground hover:bg-muted"
        aria-label={t("areaWarn.dismiss")}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export default AreaWarning;
