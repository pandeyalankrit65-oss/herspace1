import { useState } from "react";
import { CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useDailyCheckIn } from "@/hooks/use-daily-checkin";
import { useI18n } from "@/i18n";
import { syncDailyReminder } from "@/lib/dailyNotifications";

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
// Shown on home from this long before the deadline.
const SHOW_BEFORE_MS = 12 * 60 * 60 * 1000;

// For someone living alone: "If I haven't said I'm fine by 10:00, tell my contacts."
export const DailyCheckInSettings = () => {
  const { t } = useI18n();
  const { toast } = useToast();
  const { daily, turnOn, pause, turnOff } = useDailyCheckIn();
  const [deadline, setDeadline] = useState("10:00");
  const reminder = { title: t("daily.notifyTitle"), body: t("daily.notifyBody") };
  if (!daily) return null;
  return (
    <Card id="daily-check-in" className="scroll-mt-24">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarCheck className="h-5 w-5 text-primary" /> {t("daily.title")}
        </CardTitle>
        <CardDescription>{t("daily.desc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {daily.active ? (
          <>
            <p className="text-sm font-medium">{t("daily.on", { deadline: daily.deadline, next: new Date(daily.nextDueAt).toLocaleString([], { weekday: "long", hour: "2-digit", minute: "2-digit" }) })}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => pause(3).then(() => toast({ title: t("daily.paused") }))}>
                {t("daily.pause3")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await turnOff();
                  void syncDailyReminder(null, reminder);
                }}
              >
                {t("daily.turnOff")}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="daily-deadline">{t("daily.deadline")}</Label>
              <Input id="daily-deadline" type="time" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="w-36" />
            </div>
            <Button
              variant="hero"
              disabled={!deadline}
              onClick={async () => {
                await turnOn(deadline);
                void syncDailyReminder(deadline, reminder);
              }}
            >
              {t("daily.turnOn")}
            </Button>
          </div>
        )}
        <p className="text-xs text-muted-foreground">{t("daily.note")}</p>
      </CardContent>
    </Card>
  );
};

// Home, near the deadline (or after a missed one): one tap to say "I'm fine".
export const DailyCheckInCard = () => {
  const { t, tn } = useI18n();
  const { daily, imFine } = useDailyCheckIn();
  const [told, setTold] = useState<number | null>(null);
  if (told !== null) return told > 0 ? <p className="rounded-2xl bg-success/10 p-4 text-sm font-medium">{tn("daily.toldOkay", told)}</p> : null;
  if (!daily?.active) return null;
  const missed = Boolean(daily.lastAlertedAt && (!daily.lastOkAt || daily.lastAlertedAt >= daily.lastOkAt));
  const dueSoon = new Date(daily.nextDueAt).getTime() - Date.now() <= SHOW_BEFORE_MS;
  if (!missed && !dueSoon) return null;
  return (
    <section aria-labelledby="daily-card" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-5">
      <div>
        <h2 id="daily-card" className="flex items-center gap-2 font-bold">
          <CalendarCheck className="h-5 w-5 text-primary" /> {t(missed ? "daily.missedTitle" : "daily.cardTitle")}
        </h2>
        <p className="text-sm">{missed ? t("daily.missedText") : t("daily.cardText", { time: time(daily.nextDueAt) })}</p>
      </div>
      <Button variant="hero" onClick={async () => setTold(await imFine())}>
        {t("daily.imFine")}
      </Button>
    </section>
  );
};
