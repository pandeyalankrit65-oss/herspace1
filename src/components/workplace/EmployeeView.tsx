import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, EyeOff, FileSignature, LifeBuoy, MessageCircle, Send, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import Thread, { CategoryLabel, StatusPill } from "./Thread";
import { CATEGORIES, categoryKey, type Category, type WorkplaceReport } from "./types";

const day = (iso: string) => new Date(iso).toLocaleDateString([], { dateStyle: "medium" });

// An employee's side: report to HR (anonymous by default) and follow up on past reports.
const EmployeeView = ({ onLeave }: { onLeave: () => void }) => {
  const { t } = useI18n();
  const { toast } = useToast();
  const [reports, setReports] = useState<WorkplaceReport[] | null>(null);
  const [category, setCategory] = useState<Category>("harassment");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [shareIdentity, setShareIdentity] = useState(false);
  const [sending, setSending] = useState(false);

  const load = useCallback(() => {
    api<{ reports: WorkplaceReport[] }>("/api/workplace/reports/mine")
      .then((r) => setReports(r.reports))
      .catch(() => setReports([]));
  }, []);
  useEffect(load, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      await api("/api/workplace/reports", {
        body: { category, description, date, location, shareIdentity },
      });
      toast({
        title: t("work.sentTitle"),
        description: shareIdentity ? t("work.sentNamed") : t("work.sentAnonymous"),
      });
      setDescription("");
      setDate("");
      setLocation("");
      setShareIdentity(false);
      load();
    } catch (err) {
      toast({
        title: t("work.sendFailed"),
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const leave = async () => {
    try {
      await api("/api/workplace/leave", { method: "POST" });
      onLeave();
    } catch (err) {
      toast({
        title: t("work.leaveFailed"),
        description: (err as Error).message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-10">
        <form onSubmit={submit} className="space-y-5 rounded-[2rem] bg-card p-6 shadow-card ring-1 ring-border sm:p-8">
          <div>
            <h2 className="text-2xl font-extrabold">{t("work.reportTitle")}</h2>
            <p className="mt-1 text-muted-foreground">{t("work.reportText")}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="work-category">{t("work.category")}</Label>
              <select
                id="work-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {t(categoryKey(c))}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="work-date">{t("work.date")}</Label>
              <Input id="work-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="work-description">{t("work.description")}</Label>
            <Textarea
              id="work-description"
              rows={5}
              maxLength={5000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("work.descriptionHint")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="work-location">{t("work.location")}</Label>
            <Input
              id="work-location"
              value={location}
              maxLength={200}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={t("work.locationHint")}
            />
          </div>
          <div className="flex items-start gap-4 rounded-2xl bg-muted/60 p-4">
            {shareIdentity ? (
              <UserRound className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            ) : (
              <EyeOff className="mt-0.5 h-5 w-5 shrink-0 text-success" />
            )}
            <div className="min-w-0 flex-1">
              <label htmlFor="work-share" className="font-semibold">
                {t("work.shareIdentity")}
              </label>
              <p className="text-sm text-muted-foreground">{shareIdentity ? t("work.shareOn") : t("work.shareOff")}</p>
            </div>
            <Switch id="work-share" checked={shareIdentity} onCheckedChange={setShareIdentity} />
          </div>
          <Button type="submit" variant="hero" size="lg" className="gap-2" disabled={sending || description.trim().length < 10}>
            <Send className="h-4 w-4" /> {sending ? t("work.sending") : t("work.submit")}
          </Button>
        </form>

        <section className="space-y-4">
          <h2 className="text-2xl font-extrabold">{t("work.myReports")}</h2>
          {reports === null ? (
            <div className="h-24 animate-pulse rounded-3xl bg-muted" />
          ) : reports.length === 0 ? (
            <p className="text-muted-foreground">{t("work.noReports")}</p>
          ) : (
            reports.map((r) => (
              <article key={r.id} className="space-y-4 rounded-3xl bg-card p-6 shadow-card ring-1 ring-border">
                <header className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold">
                      <CategoryLabel category={r.category} />
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {t("work.sentOn", { date: day(r.createdAt) })} · {r.shareIdentity ? t("work.withName") : t("work.anonymous")}
                    </p>
                  </div>
                  <StatusPill status={r.status} />
                </header>
                {r.formal && !r.formal.closed && (
                  <p className="rounded-lg bg-primary/5 p-2 text-sm">
                    {r.formal.conciliation
                      ? t("work.formalConciliation", { date: day(r.formal.receivedOn) })
                      : t("work.formal", { date: day(r.formal.receivedOn), by: day(r.formal.inquiryBy) })}
                  </p>
                )}
                <p className="whitespace-pre-wrap text-muted-foreground">{r.description}</p>
                <Thread reportId={r.id} messages={r.messages} asHr={false} onSent={load} />
              </article>
            ))
          )}
        </section>
      </div>

      <aside className="space-y-4">
        <h2 className="text-lg font-bold">{t("work.helpTitle")}</h2>
        {[
          {
            to: "/help#work",
            icon: LifeBuoy,
            label: "work.helpRights" as const,
          },
          {
            to: "/complaint",
            icon: FileSignature,
            label: "work.helpLetter" as const,
          },
          {
            to: "/support",
            icon: MessageCircle,
            label: "work.helpTalk" as const,
          },
        ].map(({ to, icon: Icon, label }) => (
          <Link
            key={to}
            to={to}
            className="group flex items-center gap-4 rounded-2xl bg-card p-4 shadow-card ring-1 ring-border transition-all hover:ring-primary/40"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </span>
            <span className="flex-1 font-semibold">{t(label)}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
          </Link>
        ))}
        <p className="rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">{t("work.privacyNote")}</p>
        <button
          type="button"
          onClick={leave}
          className="text-sm font-semibold text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          {t("work.leave")}
        </button>
      </aside>
    </div>
  );
};

export default EmployeeView;
