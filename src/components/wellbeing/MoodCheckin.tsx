import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { HeartHandshake, MessageCircle, Phone, Smile, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import type { MessageKey } from "@/i18n/en";
import { deleteJournal, localDay, needsSupport, saveMood, type Mood, type MoodEntry } from "@/lib/mood";
import { cn } from "@/lib/utils";

const MOODS: Array<{ mood: Mood; face: string; label: MessageKey; color: string }> = [
  { mood: 1, face: "😣", label: "wb.mood1", color: "bg-destructive/70" },
  { mood: 2, face: "🙁", label: "wb.mood2", color: "bg-warning/80" },
  { mood: 3, face: "😐", label: "wb.mood3", color: "bg-muted-foreground/50" },
  { mood: 4, face: "🙂", label: "wb.mood4", color: "bg-success/70" },
  { mood: 5, face: "😊", label: "wb.mood5", color: "bg-primary/80" },
];

// When things look hard: real people to talk to, now.
export const SupportCard = () => {
  const { t } = useI18n();
  const id = useId();
  return (
    <section role="region" aria-labelledby={id} className="space-y-4 rounded-3xl bg-primary/5 p-5 ring-1 ring-primary/25">
      <div className="flex items-start gap-3">
        <HeartHandshake className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
        <div>
          <h3 id={id} className="font-bold">
            {t("wb.supportTitle")}
          </h3>
          <p className="text-sm text-muted-foreground">{t("wb.supportText")}</p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <a
          href="tel:14416"
          className="flex items-center gap-2 rounded-2xl bg-card p-3 text-sm font-semibold shadow-sm ring-1 ring-border hover:ring-primary/40"
        >
          <Phone className="h-4 w-4 text-primary" /> {t("wb.callTeleManas")}
        </a>
        <Link
          to="/support"
          className="flex items-center gap-2 rounded-2xl bg-card p-3 text-sm font-semibold shadow-sm ring-1 ring-border hover:ring-primary/40"
        >
          <MessageCircle className="h-4 w-4 text-primary" /> {t("wb.talkChat")}
        </Link>
        <Link
          to="/partners"
          className="flex items-center gap-2 rounded-2xl bg-card p-3 text-sm font-semibold shadow-sm ring-1 ring-border hover:ring-primary/40"
        >
          <UserRound className="h-4 w-4 text-primary" /> {t("wb.findCounsellor")}
        </Link>
      </div>
    </section>
  );
};

// The page owns the entries, so it knows whether the support card is already showing here.
const MoodCheckin = ({ entries, setEntries }: { entries: MoodEntry[]; setEntries: (entries: MoodEntry[]) => void }) => {
  const { t } = useI18n();
  const { toast } = useToast();
  const today = entries.find((e) => e.date === localDay());
  const [mood, setMood] = useState<Mood | null>(today?.mood ?? null);
  const [note, setNote] = useState(today?.note ?? "");

  const save = () => {
    if (!mood) return;
    setEntries(saveMood(mood, note));
    toast({ title: t("wb.saved") });
  };
  const clear = () => {
    deleteJournal();
    setEntries([]);
    setMood(null);
    setNote("");
    toast({ title: t("wb.journalDeleted") });
  };

  // The last 14 days, oldest first, with gaps where there was no check-in.
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    const key = localDay(d);
    return { key, label: d.toLocaleDateString([], { weekday: "narrow" }), entry: entries.find((e) => e.date === key) };
  });

  return (
    <section aria-labelledby="mood-title" className="space-y-5 rounded-[2rem] bg-card p-6 shadow-card ring-1 ring-border sm:p-8">
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Smile className="h-6 w-6" />
        </span>
        <div>
          <h2 id="mood-title" className="text-2xl font-extrabold">
            {t("wb.moodTitle")}
          </h2>
          <p className="text-muted-foreground">{t("wb.moodText")}</p>
        </div>
      </div>

      <div role="radiogroup" aria-label={t("wb.moodTitle")} className="grid grid-cols-5 gap-2">
        {MOODS.map((m) => (
          <button
            key={m.mood}
            type="button"
            role="radio"
            aria-checked={mood === m.mood}
            onClick={() => setMood(m.mood)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-2xl p-2 ring-1 transition-colors sm:p-3",
              mood === m.mood ? "bg-primary/10 ring-2 ring-primary" : "bg-muted/40 ring-border hover:bg-muted",
            )}
          >
            <span className="text-2xl sm:text-3xl" aria-hidden="true">
              {m.face}
            </span>
            <span className="text-center text-xs font-semibold leading-tight">{t(m.label)}</span>
          </button>
        ))}
      </div>
      <div className="space-y-1.5">
        <label htmlFor="mood-note" className="text-sm font-semibold">
          {t("wb.note")}
        </label>
        <Textarea
          id="mood-note"
          rows={2}
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t("wb.notePlaceholder")}
        />
      </div>
      <Button type="button" variant="hero" onClick={save} disabled={!mood}>
        {today ? t("wb.update") : t("wb.save")}
      </Button>

      {needsSupport(entries) && <SupportCard />}

      {entries.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-bold">{t("wb.last14")}</h3>
          <ol className="flex items-end gap-1.5" aria-label={t("wb.last14")}>
            {days.map((d) => {
              const m = d.entry && MOODS[d.entry.mood - 1];
              return (
                <li key={d.key} className="flex flex-1 flex-col items-center gap-1">
                  <span
                    className={cn("w-full rounded-md", m ? m.color : "bg-muted")}
                    style={{ height: `${m ? 10 + d.entry!.mood * 9 : 6}px` }}
                    title={m ? `${d.key}: ${t(m.label)}` : d.key}
                  />
                  <span className="sr-only">{m ? `${d.key}: ${t(m.label)}` : `${d.key}: ${t("wb.noEntry")}`}</span>
                  <span className="text-[10px] text-muted-foreground" aria-hidden="true">
                    {d.label}
                  </span>
                </li>
              );
            })}
          </ol>
          {entries.some((e) => e.note) && (
            <ul className="space-y-2">
              {entries
                .filter((e) => e.note)
                .slice(0, 5)
                .map((e) => (
                  <li key={e.date} className="rounded-2xl bg-muted/50 px-4 py-2 text-sm">
                    <span className="font-semibold">{new Date(`${e.date}T12:00:00`).toLocaleDateString([], { dateStyle: "medium" })}</span>{" "}
                    <span aria-hidden="true">{MOODS[e.mood - 1].face}</span> <span className="whitespace-pre-wrap">{e.note}</span>
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
        <p className="text-sm text-muted-foreground">{t("wb.privateNote")}</p>
        {entries.length > 0 && (
          <Button type="button" variant="ghost" size="sm" className="gap-2 text-destructive" onClick={clear}>
            <Trash2 className="h-4 w-4" /> {t("wb.deleteJournal")}
          </Button>
        )}
      </div>
    </section>
  );
};

export default MoodCheckin;
