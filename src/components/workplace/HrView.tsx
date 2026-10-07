import { useCallback, useEffect, useState } from "react";
import { BarChart3, EyeOff, Inbox, RefreshCw, Settings as SettingsIcon, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import CodeBox from "@/components/CodeBox";
import { api } from "@/lib/api";
import Thread, { CategoryLabel } from "./Thread";
import { STATUSES, statusKey, type Insights, type Settings, type Status, type WorkplaceReport } from "./types";

const day = (iso: string) => new Date(iso).toLocaleDateString([], { dateStyle: "medium" });

export const NewCode = ({ code }: { code: string }) => {
  const { t } = useI18n();
  return (
    <div className="space-y-3 rounded-[2rem] bg-card p-6 shadow-card ring-1 ring-success/40 sm:p-8">
      <h2 className="text-xl font-extrabold">{t("work.codeTitle")}</h2>
      <p className="text-muted-foreground">{t("work.codeText")}</p>
      <CodeBox code={code} label={t("work.joinCode")} />
    </div>
  );
};

const ReportsTab = () => {
  const { t } = useI18n();
  const { toast } = useToast();
  const [reports, setReports] = useState<WorkplaceReport[] | null>(null);
  const [filter, setFilter] = useState<"open" | "all">("open");
  const load = useCallback(() => {
    api<{ reports: WorkplaceReport[] }>("/api/workplace/hr/reports")
      .then((r) => setReports(r.reports))
      .catch(() => setReports([]));
  }, []);
  useEffect(load, [load]);

  const setStatus = async (id: number, status: Status) => {
    try {
      await api(`/api/workplace/hr/reports/${id}`, {
        method: "PATCH",
        body: { status },
      });
      load();
    } catch (err) {
      toast({
        title: t("work.sendFailed"),
        description: (err as Error).message,
        variant: "destructive",
      });
    }
  };

  const shown = reports?.filter((r) => filter === "all" || r.status === "new" || r.status === "reviewing");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full bg-muted p-1" role="group" aria-label={t("work.filter")}>
          {(["open", "all"] as const).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold ${filter === f ? "bg-card shadow-sm" : "text-muted-foreground"}`}
            >
              {f === "open" ? t("work.filterOpen") : t("work.filterAll")}
            </button>
          ))}
        </div>
        <Button type="button" variant="ghost" size="sm" className="gap-2" onClick={load}>
          <RefreshCw className="h-4 w-4" /> {t("work.refresh")}
        </Button>
      </div>
      {shown === undefined ? (
        <div className="h-32 animate-pulse rounded-3xl bg-muted" />
      ) : shown.length === 0 ? (
        <p className="rounded-3xl bg-muted/60 p-8 text-center text-muted-foreground">
          {filter === "open" ? t("work.hrNoOpen") : t("work.hrNoReports")}
        </p>
      ) : (
        shown.map((r) => (
          <article key={r.id} className="space-y-4 rounded-3xl bg-card p-6 shadow-card ring-1 ring-border">
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <h3 className="text-lg font-bold">
                  <CategoryLabel category={r.category} />
                </h3>
                <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                  <span>{t("work.receivedOn", { date: day(r.createdAt) })}</span>
                  {r.date && (
                    <span>
                      ·{" "}
                      {t("work.happenedOn", {
                        date: day(`${r.date}T12:00:00`),
                      })}
                    </span>
                  )}
                  {r.location && <span>· {r.location}</span>}
                </p>
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  {r.reporter ? (
                    <>
                      <UserRound className="h-4 w-4 text-primary" /> {r.reporter.name} · {r.reporter.email}
                    </>
                  ) : (
                    <>
                      <EyeOff className="h-4 w-4 text-success" /> {t("work.anonymousEmployee")}
                    </>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <label className="sr-only" htmlFor={`status-${r.id}`}>
                  {t("work.changeStatus")}
                </label>
                <select
                  id={`status-${r.id}`}
                  value={r.status}
                  onChange={(e) => setStatus(r.id, e.target.value as Status)}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {t(statusKey(s))}
                    </option>
                  ))}
                </select>
              </div>
            </header>
            <p className="whitespace-pre-wrap">{r.description}</p>
            <Thread reportId={r.id} messages={r.messages} asHr onSent={load} />
          </article>
        ))
      )}
    </div>
  );
};

const Bar = ({ label, value, max }: { label: string; value: number; max: number }) => (
  <div className="grid grid-cols-[minmax(0,9rem)_1fr_2.5rem] items-center gap-3 text-sm">
    <span className="truncate text-muted-foreground">{label}</span>
    <span className="h-3 overflow-hidden rounded-full bg-muted">
      <span className="block h-full rounded-full bg-gradient-to-r from-primary to-brand" style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
    </span>
    <span className="text-right font-semibold tabular-nums">{value}</span>
  </div>
);

const InsightsTab = () => {
  const { t } = useI18n();
  const [data, setData] = useState<Insights | null>(null);
  useEffect(() => {
    api<Insights>("/api/workplace/hr/insights")
      .then(setData)
      .catch(() => {});
  }, []);
  if (!data) return <div className="h-48 animate-pulse rounded-3xl bg-muted" />;
  const tiles = [
    { label: t("work.statTotal"), value: String(data.total) },
    { label: t("work.statOpen"), value: String(data.open) },
    {
      label: t("work.statResponse"),
      value:
        data.medianResponseHours === null
          ? "—"
          : data.medianResponseHours < 1
            ? t("work.underHour")
            : t("work.hours", { count: data.medianResponseHours }),
    },
    {
      label: t("work.statMembers"),
      value: t("work.membersVerified", {
        members: data.members,
        verified: data.verifiedMembers,
      }),
    },
  ];
  const monthMax = Math.max(1, ...data.months.map((m) => m.count));
  const categories = data.byCategory ? Object.entries(data.byCategory).sort((a, b) => b[1] - a[1]) : [];
  const catMax = Math.max(1, ...categories.map(([, n]) => n));
  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-3xl bg-card p-5 shadow-card ring-1 ring-border">
            <p className="text-sm text-muted-foreground">{tile.label}</p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums">{tile.value}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4 rounded-3xl bg-card p-6 shadow-card ring-1 ring-border">
          <h3 className="font-bold">{t("work.byCategory")}</h3>
          {data.byCategory ? (
            categories.map(([c, n]) => <Bar key={c} label={t(`work.cat.${c}` as "work.cat.other")} value={n} max={catMax} />)
          ) : (
            <p className="text-sm text-muted-foreground">{t("work.tooFew")}</p>
          )}
        </section>
        <section className="space-y-4 rounded-3xl bg-card p-6 shadow-card ring-1 ring-border">
          <h3 className="font-bold">{t("work.byStatus")}</h3>
          {STATUSES.map((s) => (
            <Bar key={s} label={t(statusKey(s))} value={data.byStatus[s]} max={Math.max(1, data.total)} />
          ))}
        </section>
      </div>
      <section className="space-y-4 rounded-3xl bg-card p-6 shadow-card ring-1 ring-border">
        <h3 className="font-bold">{t("work.byMonth")}</h3>
        <div className="flex h-40 items-end gap-3">
          {data.months.map((m) => (
            <div key={m.month} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
              <span className="text-sm font-semibold tabular-nums">{m.count}</span>
              <span
                className="w-full rounded-t-lg bg-gradient-to-t from-primary to-brand"
                style={{
                  height: `${(m.count / monthMax) * 75}%`,
                  minHeight: m.count ? 6 : 2,
                }}
              />
              <span className="text-xs text-muted-foreground">
                {new Date(`${m.month}-15`).toLocaleDateString([], {
                  month: "short",
                })}
              </span>
            </div>
          ))}
        </div>
      </section>
      <p className="text-sm text-muted-foreground">{t("work.insightsNote")}</p>
    </div>
  );
};

const SettingsTab = ({ onLeave }: { onLeave: () => void }) => {
  const { t } = useI18n();
  const { toast } = useToast();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [slack, setSlack] = useState("");
  const [teams, setTeams] = useState("");
  const [email, setEmail] = useState("");
  const [newCode, setNewCode] = useState<string | null>(null);
  const [colleague, setColleague] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api<Settings>("/api/workplace/hr/settings")
      .then((s) => {
        setSettings(s);
        setSlack(s.slackWebhook ?? "");
        setTeams(s.teamsWebhook ?? "");
        setEmail(s.notifyEmail ?? "");
      })
      .catch(() => {});
  }, []);
  useEffect(load, [load]);

  const run = async (fn: () => Promise<unknown>, done: string) => {
    setSaving(true);
    try {
      await fn();
      toast({ title: done });
      load();
    } catch (err) {
      toast({
        title: t("work.saveFailed"),
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return <div className="h-48 animate-pulse rounded-3xl bg-muted" />;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-4 rounded-3xl bg-card p-6 shadow-card ring-1 ring-border">
        <h3 className="text-lg font-bold">{t("work.codeSection")}</h3>
        <p className="text-sm text-muted-foreground">{t("work.codeSectionText")}</p>
        {newCode && <CodeBox code={newCode} label={t("work.joinCode")} />}
        <Button
          type="button"
          variant="glass"
          className="gap-2"
          disabled={saving}
          onClick={() =>
            run(
              async () => setNewCode((await api<{ joinCode: string }>("/api/workplace/hr/join-code", { method: "POST" })).joinCode),
              t("work.codeMade"),
            )
          }
        >
          <RefreshCw className="h-4 w-4" /> {t("work.newCode")}
        </Button>
      </section>

      <form
        className="space-y-4 rounded-3xl bg-card p-6 shadow-card ring-1 ring-border"
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () =>
              api("/api/workplace/hr/settings", {
                method: "PUT",
                body: {
                  slackWebhook: slack.trim(),
                  teamsWebhook: teams.trim(),
                  notifyEmail: email.trim(),
                },
              }),
            t("work.saved"),
          );
        }}
      >
        <h3 className="text-lg font-bold">{t("work.notifyTitle")}</h3>
        <p className="text-sm text-muted-foreground">{t("work.notifyText")}</p>
        <div className="space-y-1.5">
          <Label htmlFor="hr-slack">{t("work.slack")}</Label>
          <Input id="hr-slack" value={slack} onChange={(e) => setSlack(e.target.value)} placeholder="https://hooks.slack.com/services/..." />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hr-teams">{t("work.teams")}</Label>
          <Input id="hr-teams" value={teams} onChange={(e) => setTeams(e.target.value)} placeholder="https://....webhook.office.com/..." />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hr-email">{t("work.notifyEmail")}</Label>
          <Input id="hr-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="hr@company.com" />
        </div>
        <Button type="submit" variant="hero" disabled={saving}>
          {t("work.save")}
        </Button>
      </form>

      <section className="space-y-4 rounded-3xl bg-card p-6 shadow-card ring-1 ring-border lg:col-span-2">
        <h3 className="text-lg font-bold">{t("work.hrTeam")}</h3>
        <ul className="flex flex-wrap gap-2">
          {settings.hrTeam.map((p) => (
            <li key={p.email} className="rounded-full bg-muted px-3 py-1.5 text-sm">
              <span className="font-semibold">{p.name}</span> <span className="text-muted-foreground">{p.email}</span>
            </li>
          ))}
        </ul>
        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () =>
                api("/api/workplace/hr/team", {
                  body: { email: colleague },
                }).then(() => setColleague("")),
              t("work.addedToHr"),
            );
          }}
        >
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="hr-colleague">{t("work.addHr")}</Label>
            <Input
              id="hr-colleague"
              type="email"
              value={colleague}
              onChange={(e) => setColleague(e.target.value)}
              placeholder="colleague@company.com"
            />
          </div>
          <Button type="submit" variant="glass" disabled={saving || !colleague.includes("@")}>
            {t("work.add")}
          </Button>
        </form>
        <p className="text-sm text-muted-foreground">{t("work.addHrHint")}</p>
        <button
          type="button"
          onClick={() =>
            api("/api/workplace/leave", { method: "POST" })
              .then(onLeave)
              .catch((err: Error) =>
                toast({
                  title: t("work.leaveFailed"),
                  description: err.message,
                  variant: "destructive",
                }),
              )
          }
          className="text-sm font-semibold text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          {t("work.leave")}
        </button>
      </section>
    </div>
  );
};

// HR's side: work through reports, see trends, and set up notifications and the team.
const HrView = ({ onLeave }: { onLeave: () => void }) => {
  const { t } = useI18n();
  return (
    <Tabs defaultValue="reports" className="space-y-6">
      <TabsList className="grid h-auto w-full grid-cols-3 gap-1 rounded-2xl p-1.5 sm:inline-flex sm:w-auto">
        <TabsTrigger value="reports" className="gap-2 rounded-xl px-3 py-2 sm:px-4">
          <Inbox className="h-4 w-4" /> {t("work.tabReports")}
        </TabsTrigger>
        <TabsTrigger value="insights" className="gap-2 rounded-xl px-3 py-2 sm:px-4">
          <BarChart3 className="h-4 w-4" /> {t("work.tabInsights")}
        </TabsTrigger>
        <TabsTrigger value="settings" className="gap-2 rounded-xl px-3 py-2 sm:px-4">
          <SettingsIcon className="h-4 w-4" /> {t("work.tabSettings")}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="reports">
        <ReportsTab />
      </TabsContent>
      <TabsContent value="insights">
        <InsightsTab />
      </TabsContent>
      <TabsContent value="settings">
        <SettingsTab onLeave={onLeave} />
      </TabsContent>
    </Tabs>
  );
};

export default HrView;
