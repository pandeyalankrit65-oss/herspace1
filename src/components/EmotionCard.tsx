import { Link } from "react-router-dom";
import { FileSignature, FileText, Footprints, Heart, Phone, ShieldAlert, UserRound, Wind, X } from "lucide-react";
import { useI18n } from "@/i18n";
import type { MessageKey } from "@/i18n/en";
import type { ActionableEmotion } from "@/lib/emotion";

type Action = { to: string; icon: typeof Heart; label: MessageKey; strong?: boolean };

// What helps with each feeling, from the app's own tools.
const ACTIONS: Record<ActionableEmotion["label"], Action[]> = {
  panic: [
    { to: "/wellbeing", icon: Wind, label: "emotion.breathe", strong: true },
    { to: "/wellbeing", icon: Heart, label: "emotion.ground" },
  ],
  fear: [
    { to: "/sos#fake-call", icon: Phone, label: "emotion.fakeCall" },
    { to: "/walk", icon: Footprints, label: "emotion.walk" },
  ],
  sadness: [
    { to: "/wellbeing", icon: Heart, label: "emotion.checkIn", strong: true },
    { to: "/partners", icon: UserRound, label: "emotion.counsellor" },
  ],
  anger: [
    { to: "/report", icon: FileText, label: "emotion.report", strong: true },
    { to: "/complaint", icon: FileSignature, label: "emotion.complaint" },
  ],
};

// The chat's reading of how she seems, said openly, with help that fits and a way to say it's wrong.
const EmotionCard = ({ emotion, onDismiss }: { emotion: ActionableEmotion; onDismiss: () => void }) => {
  const { t } = useI18n();
  const actions = [...ACTIONS[emotion.label]];
  // Strong fear gets SOS here too, unless it's already danger: then the danger banner shows it.
  if (emotion.label === "fear" && emotion.intensity === "high" && emotion.urgency !== "danger")
    actions.unshift({ to: "/sos?start=sos", icon: ShieldAlert, label: "distress.sos", strong: true });
  return (
    <section aria-label={t("emotion.region")} className="relative space-y-2 rounded-2xl bg-secondary/60 p-3 pr-9 ring-1 ring-border">
      <p className="text-sm font-semibold">{t(`emotion.seems.${emotion.label}` as MessageKey)}</p>
      <p className="text-xs text-muted-foreground">{emotion.source === "ai" ? t("emotion.byAi") : t("emotion.byWords")}</p>
      <div className="flex flex-wrap gap-2">
        {actions.map(({ to, icon: Icon, label, strong }) => (
          <Link
            key={label}
            to={to}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${
              strong
                ? label === "distress.sos"
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-primary text-primary-foreground"
                : "bg-card ring-1 ring-border hover:bg-muted"
            }`}
          >
            <Icon className="h-4 w-4" /> {t(label)}
          </Link>
        ))}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground hover:bg-muted"
        aria-label={t("emotion.notRight")}
      >
        <X className="h-4 w-4" />
      </button>
    </section>
  );
};

export default EmotionCard;
