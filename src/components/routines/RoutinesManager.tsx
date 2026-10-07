import { useState } from "react";
import { CalendarClock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import type { MessageKey } from "@/i18n/en";
import { usePlaces } from "@/lib/places";
import { MAX_ROUTINES, saveRoutines, useRoutines, type Routine } from "@/lib/routines";
import { syncRoutineNotifications } from "@/lib/routineNotifications";
import { cn } from "@/lib/utils";

// Monday first, as most people read a week; values are Date.getDay() numbers.
const DAYS: Array<{ day: number; label: MessageKey }> = [
  { day: 1, label: "routine.mon" },
  { day: 2, label: "routine.tue" },
  { day: 3, label: "routine.wed" },
  { day: 4, label: "routine.thu" },
  { day: 5, label: "routine.fri" },
  { day: 6, label: "routine.sat" },
  { day: 0, label: "routine.sun" },
];

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

// Set up regular journeys: a reminder to share the journey at its usual time.
const RoutinesManager = () => {
  const { t } = useI18n();
  const { toast } = useToast();
  const routines = useRoutines();
  const places = usePlaces();
  const [label, setLabel] = useState("");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [time, setTime] = useState("21:00");
  const [kind, setKind] = useState<"walk" | "ride">("walk");
  const [placeId, setPlaceId] = useState("");

  const store = (next: Routine[]) => {
    saveRoutines(next);
    void syncRoutineNotifications(next, (r) => ({ title: t("routine.dueTitle"), body: t("routine.dueText", { label: r.label, time: r.time }) }));
  };

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const routine: Routine = { id: crypto.randomUUID(), label: label.trim(), days: [...days].sort(), time, kind, ...(placeId ? { placeId } : {}) };
    store([...routines, routine]);
    setLabel("");
    toast({ title: t("routine.added"), description: t("routine.addedText") });
  };
  const remove = (id: string) => store(routines.filter((r) => r.id !== id));
  const dayNames = (r: Routine) =>
    DAYS.filter((d) => r.days.includes(d.day))
      .map((d) => t(d.label))
      .join(", ");

  return (
    <section aria-labelledby="routines-title" className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div>
          <h2 id="routines-title" className="font-bold">
            {t("routine.title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("routine.intro")}</p>
        </div>
      </div>

      {routines.length > 0 && (
        <ul className="space-y-2">
          {routines.map((r) => (
            <li key={r.id} className="flex items-center gap-3 rounded-xl bg-muted/50 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{r.label}</p>
                <p className="text-xs text-muted-foreground">
                  {dayNames(r)} · {r.time} · {r.kind === "ride" ? t("routine.ride") : t("routine.walk")}
                  {r.placeId && places.find((p) => p.id === r.placeId) && <> · {places.find((p) => p.id === r.placeId)!.label}</>}
                </p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => remove(r.id)} aria-label={t("routine.remove", { label: r.label })}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {routines.length < MAX_ROUTINES && (
        <form onSubmit={add} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="routine-label">{t("routine.label")}</Label>
            <Input
              id="routine-label"
              value={label}
              maxLength={60}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t("routine.labelPlaceholder")}
            />
          </div>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">{t("routine.days")}</legend>
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map((d) => (
                <button
                  key={d.day}
                  type="button"
                  aria-pressed={days.includes(d.day)}
                  onClick={() => setDays((prev) => (prev.includes(d.day) ? prev.filter((x) => x !== d.day) : [...prev, d.day]))}
                  className={cn(
                    "rounded-full px-3 py-1 text-sm font-semibold ring-1",
                    days.includes(d.day) ? "bg-primary text-primary-foreground ring-primary" : "bg-background text-muted-foreground ring-border",
                  )}
                >
                  {t(d.label)}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="routine-time">{t("routine.time")}</Label>
              <Input id="routine-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="routine-kind">{t("routine.how")}</Label>
              <select id="routine-kind" value={kind} onChange={(e) => setKind(e.target.value as "walk" | "ride")} className={selectClass}>
                <option value="walk">{t("routine.walk")}</option>
                <option value="ride">{t("routine.ride")}</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="routine-place">{t("routine.place")}</Label>
              <select id="routine-place" value={placeId} onChange={(e) => setPlaceId(e.target.value)} className={selectClass}>
                <option value="">{t("routine.noPlace")}</option>
                {places.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Button type="submit" variant="outline" disabled={!label.trim() || days.length === 0 || !time}>
            {t("routine.add")}
          </Button>
        </form>
      )}
      <p className="text-xs text-muted-foreground">{t("routine.private")}</p>
    </section>
  );
};

export default RoutinesManager;
