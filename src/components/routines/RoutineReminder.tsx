import { Link } from "react-router-dom";
import { Footprints, X } from "lucide-react";
import { useI18n } from "@/i18n";
import { dismissForToday, useDueRoutine } from "@/lib/routines";

// "Time for your usual journey": shown while a regular journey is due, with one tap to start.
const RoutineReminder = ({ className = "" }: { className?: string }) => {
  const { t } = useI18n();
  const due = useDueRoutine();
  if (!due) return null;
  return (
    <div
      role="status"
      className={`relative flex flex-wrap items-center gap-3 rounded-2xl bg-primary/10 p-4 pr-10 ring-1 ring-primary/25 ${className}`}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Footprints className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold">{t("routine.dueTitle")}</p>
        <p className="text-sm text-muted-foreground">{t("routine.dueText", { label: due.label, time: due.time })}</p>
      </div>
      <Link
        to={`/walk?routine=${encodeURIComponent(due.id)}`}
        className="inline-flex items-center rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
      >
        {t("routine.start")}
      </Link>
      <button
        type="button"
        onClick={() => dismissForToday(due.id)}
        className="absolute right-2 top-2 rounded-full p-1.5 text-muted-foreground hover:bg-muted"
        aria-label={t("routine.notToday")}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export default RoutineReminder;
