import { Link } from "react-router-dom";
import { HeartHandshake, Phone, ShieldAlert, Wind, X } from "lucide-react";
import { EMERGENCY_NUMBER } from "@/lib/api";
import { useI18n } from "@/i18n";
import type { Distress } from "@/lib/distress";

const action = "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors";

// Shown in the support chat as soon as a message suggests danger or self-harm: a way to act
// right now, before (or instead of) reading the reply.
const DistressBanner = ({ kind, onDismiss }: { kind: Distress; onDismiss: () => void }) => {
  const { t } = useI18n();
  const danger = kind === "danger";
  return (
    <div
      role="alert"
      className={`relative space-y-3 rounded-2xl p-4 pr-10 ring-1 ${danger ? "bg-destructive/10 ring-destructive/30" : "bg-primary/10 ring-primary/30"}`}
    >
      <p className="flex items-start gap-2 font-bold">
        {danger ? (
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        ) : (
          <HeartHandshake className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        )}
        {danger ? t("distress.dangerTitle") : t("distress.selfHarmTitle")}
      </p>
      <p className="text-sm">{danger ? t("distress.dangerText") : t("distress.selfHarmText")}</p>
      <div className="flex flex-wrap gap-2">
        {danger ? (
          <>
            <Link to="/sos?start=sos" className={`${action} bg-destructive text-destructive-foreground hover:bg-destructive/90`}>
              <ShieldAlert className="h-4 w-4" /> {t("distress.sos")}
            </Link>
            <a href={`tel:${EMERGENCY_NUMBER}`} className={`${action} bg-card ring-1 ring-border hover:bg-muted`}>
              <Phone className="h-4 w-4" /> {t("common.call", { number: EMERGENCY_NUMBER })}
            </a>
          </>
        ) : (
          <>
            <a href="tel:14416" className={`${action} bg-primary text-primary-foreground hover:bg-primary/90`}>
              <Phone className="h-4 w-4" /> {t("distress.teleManas")}
            </a>
            <a href={`tel:${EMERGENCY_NUMBER}`} className={`${action} bg-card ring-1 ring-border hover:bg-muted`}>
              <Phone className="h-4 w-4" /> {t("common.call", { number: EMERGENCY_NUMBER })}
            </a>
            <Link to="/wellbeing" className={`${action} bg-card ring-1 ring-border hover:bg-muted`}>
              <Wind className="h-4 w-4" /> {t("distress.breathe")}
            </Link>
          </>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="absolute right-2 top-2 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label={t("distress.dismiss")}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export default DistressBanner;
