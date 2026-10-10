import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CalendarClock, FileText, Plus, Printer, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import type { MessageKey } from "@/i18n/en";
import { api } from "@/lib/api";
import { CategoryLabel } from "./Thread";
import { CATEGORIES, type Category, type WorkplaceReport } from "./types";

// POSH Internal Committee tools: the committee and whether it's made up as the Act requires,
// formal complaints with their legal deadlines, and the Rule 14 annual report. A help, not legal
// advice; the server applies the rules (server/src/posh.ts).

const ROLES = ["presiding", "employee", "external"] as const;
const ACTIONS = ["not_proved", "apology", "warning", "reprimand", "withhold_promotion", "counselling", "community_service", "termination", "other"] as const;
type Member = { name: string; role: (typeof ROLES)[number]; woman: boolean; termStart: string; termEnd: string };
type Problem = { problem: string; name?: string };
type Due = { step: "notice" | "reply" | "inquiry" | "report" | "action"; by: string; overdue: boolean; daysLeft: number };
type Case = {
  id: number;
  reportId: number | null;
  category: Category;
  receivedOn: string;
  conciliation: boolean;
  noticeSentOn: string | null;
  replyReceivedOn: string | null;
  inquiryCompletedOn: string | null;
  reportSubmittedOn: string | null;
  actionTakenOn: string | null;
  action: (typeof ACTIONS)[number] | null;
  closedOn: string | null;
  next: Due | null;
};
type IcState = { members: Member[]; problems: Problem[]; cases: Case[]; workshops: Record<string, number> };
type Annual = {
  organisation: string;
  year: number;
  received: number;
  disposed: number;
  pendingOver90Days: number;
  workshops: number;
  actions: Partial<Record<(typeof ACTIONS)[number], number>>;
  members: Member[];
};

const today = () => new Date().toLocaleDateString("en-CA");
const dateLabel = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
const STEPS = [
  ["noticeSentOn", "ic.step.notice"],
  ["replyReceivedOn", "ic.step.reply"],
  ["inquiryCompletedOn", "ic.step.inquiry"],
  ["reportSubmittedOn", "ic.step.report"],
  ["actionTakenOn", "ic.step.action"],
  ["closedOn", "ic.step.closed"],
] as const;

const InternalCommittee = () => {
  const { t } = useI18n();
  const [state, setState] = useState<IcState | null>(null);
  const load = useCallback(() => api<IcState>("/api/workplace/ic").then(setState), []);
  useEffect(() => {
    void load();
  }, [load]);
  if (!state) return <p className="text-muted-foreground">{t("common.loading")}</p>;
  return (
    <div className="space-y-8">
      <p className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground print:hidden">{t("ic.disclaimer")}</p>
      <Committee state={state} onSaved={load} />
      <Cases state={state} onChanged={load} />
      <AnnualReport workshops={state.workshops} onChanged={load} />
    </div>
  );
};

const Committee = ({ state, onSaved }: { state: IcState; onSaved: () => void }) => {
  const { t } = useI18n();
  const { toast } = useToast();
  const [members, setMembers] = useState<Member[]>(state.members);
  const [busy, setBusy] = useState(false);
  const set = (i: number, patch: Partial<Member>) => setMembers(members.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  const save = async () => {
    setBusy(true);
    try {
      await api("/api/workplace/ic/members", { method: "PUT", body: { members } });
      toast({ title: t("ic.saved") });
      onSaved();
    } catch (err) {
      toast({ title: (err as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <section aria-labelledby="ic-members" className="space-y-3 print:hidden">
      <h3 id="ic-members" className="flex items-center gap-2 text-lg font-bold">
        <Users className="h-5 w-5 text-primary" /> {t("ic.membersTitle")}
      </h3>
      <p className="text-sm text-muted-foreground">{t("ic.membersDesc")}</p>
      {state.problems.length > 0 && (
        <ul role="alert" className="space-y-1 rounded-xl border border-warning/50 bg-warning/10 p-3 text-sm">
          {state.problems.map((p, i) => (
            <li key={i} className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              {t(`ic.problem.${p.problem}` as MessageKey, { name: p.name ?? "" })}
            </li>
          ))}
        </ul>
      )}
      <div className="space-y-3">
        {members.map((m, i) => (
          <fieldset key={i} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[1.5fr_1.2fr_auto_1fr_1fr_auto] sm:items-end">
            <legend className="sr-only">{t("ic.memberN", { n: i + 1 })}</legend>
            <div className="space-y-1">
              <Label htmlFor={`ic-name-${i}`}>{t("ic.name")}</Label>
              <Input id={`ic-name-${i}`} value={m.name} onChange={(e) => set(i, { name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`ic-role-${i}`}>{t("ic.role")}</Label>
              <select
                id={`ic-role-${i}`}
                className="h-10 w-full rounded-md border bg-background px-2 text-sm"
                value={m.role}
                onChange={(e) => set(i, { role: e.target.value as Member["role"] })}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {t(`ic.role.${r}`)}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex h-10 items-center gap-2 text-sm">
              <Checkbox checked={m.woman} onCheckedChange={(v) => set(i, { woman: v === true })} /> {t("ic.woman")}
            </label>
            <div className="space-y-1">
              <Label htmlFor={`ic-start-${i}`}>{t("ic.termStart")}</Label>
              <Input id={`ic-start-${i}`} type="date" value={m.termStart} onChange={(e) => set(i, { termStart: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`ic-end-${i}`}>{t("ic.termEnd")}</Label>
              <Input id={`ic-end-${i}`} type="date" value={m.termEnd} onChange={(e) => set(i, { termEnd: e.target.value })} />
            </div>
            <Button type="button" variant="ghost" size="icon" aria-label={t("ic.removeMember", { name: m.name || t("ic.memberN", { n: i + 1 }) })} onClick={() => setMembers(members.filter((_, j) => j !== i))}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </fieldset>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={() => {
            const start = today();
            const end = new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000 - 24 * 60 * 60 * 1000).toLocaleDateString("en-CA");
            setMembers([...members, { name: "", role: members.some((m) => m.role === "presiding") ? "employee" : "presiding", woman: true, termStart: start, termEnd: end }]);
          }}
        >
          <Plus className="h-4 w-4" /> {t("ic.addMember")}
        </Button>
        <Button type="button" variant="hero" onClick={save} disabled={busy || members.some((m) => !m.name.trim())}>
          {t("ic.saveMembers")}
        </Button>
      </div>
    </section>
  );
};

const Cases = ({ state, onChanged }: { state: IcState; onChanged: () => void }) => {
  const { t } = useI18n();
  const { toast } = useToast();
  const [reports, setReports] = useState<WorkplaceReport[]>([]);
  const [from, setFrom] = useState<string>("");
  const [category, setCategory] = useState<Category>("harassment");
  const [receivedOn, setReceivedOn] = useState(today());
  useEffect(() => {
    api<{ reports: WorkplaceReport[] }>("/api/workplace/hr/reports")
      .then((r) => setReports(r.reports))
      .catch(() => {});
  }, []);
  const linked = new Set(state.cases.map((c) => c.reportId));
  const open = reports.filter((r) => !linked.has(r.id));
  const add = async () => {
    try {
      await api("/api/workplace/ic/cases", { body: from ? { reportId: Number(from), receivedOn } : { category, receivedOn } });
      setFrom("");
      onChanged();
    } catch (err) {
      toast({ title: (err as Error).message, variant: "destructive" });
    }
  };
  return (
    <section aria-labelledby="ic-cases" className="space-y-3 print:hidden">
      <h3 id="ic-cases" className="flex items-center gap-2 text-lg font-bold">
        <CalendarClock className="h-5 w-5 text-primary" /> {t("ic.casesTitle")}
      </h3>
      <p className="text-sm text-muted-foreground">{t("ic.casesDesc")}</p>
      <div className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
        <div className="space-y-1">
          <Label htmlFor="ic-from">{t("ic.caseFrom")}</Label>
          <select id="ic-from" className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={from} onChange={(e) => setFrom(e.target.value)}>
            <option value="">{t("ic.caseOutside")}</option>
            {open.map((r) => (
              <option key={r.id} value={r.id}>
                {t("ic.caseReport", { date: dateLabel(r.createdAt.slice(0, 10)), what: t(`work.cat.${r.category}`) })}
              </option>
            ))}
          </select>
          {!from && (
            <select aria-label={t("work.category")} className="mt-2 h-10 w-full rounded-md border bg-background px-2 text-sm" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`work.cat.${c}`)}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="ic-received">{t("ic.receivedOn")}</Label>
          <Input id="ic-received" type="date" max={today()} value={receivedOn} onChange={(e) => setReceivedOn(e.target.value)} />
        </div>
        <Button type="button" variant="hero" className="gap-2" onClick={add}>
          <Plus className="h-4 w-4" /> {t("ic.addCase")}
        </Button>
      </div>
      {state.cases.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("ic.noCases")}</p>
      ) : (
        state.cases.map((c) => <CaseCard key={c.id} c={c} onChanged={onChanged} />)
      )}
    </section>
  );
};

const CaseCard = ({ c, onChanged }: { c: Case; onChanged: () => void }) => {
  const { t } = useI18n();
  const { toast } = useToast();
  const [draft, setDraft] = useState(c);
  const update = async (patch: Partial<Case>) => {
    setDraft({ ...draft, ...patch });
    try {
      await api(`/api/workplace/ic/cases/${c.id}`, { method: "PATCH", body: patch });
      onChanged();
    } catch (err) {
      toast({ title: (err as Error).message, variant: "destructive" });
      setDraft(c);
    }
  };
  return (
    <article className="space-y-3 rounded-xl border p-4" aria-label={t("ic.caseLabel", { date: dateLabel(c.receivedOn) })}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">
          <CategoryLabel category={c.category} /> · {t("ic.receivedOnDate", { date: dateLabel(c.receivedOn) })}
          {c.reportId && <span className="ml-2 text-xs text-muted-foreground">{t("ic.fromHerSpace")}</span>}
        </p>
        {c.closedOn ? (
          <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold">{t("ic.closed")}</span>
        ) : c.next ? (
          <span role="status" className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.next.overdue ? "bg-destructive/15 text-destructive" : "bg-primary/10"}`}>
            {t(c.next.overdue ? "ic.overdue" : "ic.due", { step: t(`ic.next.${c.next.step}`), date: dateLabel(c.next.by) })}
          </span>
        ) : null}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={draft.conciliation} onCheckedChange={(v) => update({ conciliation: v === true })} /> {t("ic.conciliation")}
      </label>
      <div className="grid gap-2 sm:grid-cols-3">
        {STEPS.map(([key, label]) => (
          <div key={key} className="space-y-1">
            <Label htmlFor={`case-${c.id}-${key}`}>{t(label)}</Label>
            <Input
              id={`case-${c.id}-${key}`}
              type="date"
              min={c.receivedOn}
              max={today()}
              value={draft[key] ?? ""}
              onChange={(e) => update({ [key]: e.target.value || null })}
            />
          </div>
        ))}
        <div className="space-y-1">
          <Label htmlFor={`case-${c.id}-what`}>{t("ic.actionTaken")}</Label>
          <select
            id={`case-${c.id}-what`}
            className="h-10 w-full rounded-md border bg-background px-2 text-sm"
            value={draft.action ?? ""}
            onChange={(e) => update({ action: (e.target.value || null) as Case["action"] })}
          >
            <option value="">{t("ic.actionNone")}</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {t(`ic.action.${a}`)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <button
        type="button"
        className="flex items-center gap-1 text-xs text-destructive underline-offset-2 hover:underline"
        onClick={async () => {
          await api(`/api/workplace/ic/cases/${c.id}`, { method: "DELETE" });
          onChanged();
        }}
      >
        <Trash2 className="h-3.5 w-3.5" /> {t("ic.deleteCase")}
      </button>
    </article>
  );
};

const AnnualReport = ({ workshops, onChanged }: { workshops: Record<string, number>; onChanged: () => void }) => {
  const { t } = useI18n();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [report, setReport] = useState<Annual | null>(null);
  const [count, setCount] = useState(String(workshops[year] ?? 0));
  useEffect(() => {
    setCount(String(workshops[year] ?? 0));
    api<Annual>(`/api/workplace/ic/annual/${year}`)
      .then(setReport)
      .catch(() => setReport(null));
  }, [year, workshops]);
  const saveWorkshops = async () => {
    await api(`/api/workplace/ic/workshops/${year}`, { method: "PUT", body: { count: Number(count) || 0 } });
    onChanged();
  };
  return (
    <section aria-labelledby="ic-annual" className="space-y-3">
      <h3 id="ic-annual" className="flex items-center gap-2 text-lg font-bold print:hidden">
        <FileText className="h-5 w-5 text-primary" /> {t("ic.annualTitle")}
      </h3>
      <p className="text-sm text-muted-foreground print:hidden">{t("ic.annualDesc")}</p>
      <div className="flex flex-wrap items-end gap-2 print:hidden">
        <div className="space-y-1">
          <Label htmlFor="ic-year">{t("ic.year")}</Label>
          <select id="ic-year" className="h-10 rounded-md border bg-background px-2 text-sm" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[thisYear, thisYear - 1, thisYear - 2].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="ic-workshops">{t("ic.workshops")}</Label>
          <Input id="ic-workshops" type="number" min={0} className="w-28" value={count} onChange={(e) => setCount(e.target.value)} onBlur={saveWorkshops} />
        </div>
        <Button type="button" variant="outline" className="gap-2" onClick={() => window.print()} disabled={!report}>
          <Printer className="h-4 w-4" /> {t("ic.print")}
        </Button>
      </div>
      {report && (
        <div className="space-y-2 rounded-xl border p-4 text-sm print:border-0">
          <p className="font-bold">{t("ic.reportHeading", { org: report.organisation, year: report.year })}</p>
          <dl className="grid gap-1 sm:grid-cols-[auto_1fr] sm:gap-x-6">
            <dt>{t("ic.row.received")}</dt>
            <dd className="font-semibold">{report.received}</dd>
            <dt>{t("ic.row.disposed")}</dt>
            <dd className="font-semibold">{report.disposed}</dd>
            <dt>{t("ic.row.pending")}</dt>
            <dd className="font-semibold">{report.pendingOver90Days}</dd>
            <dt>{t("ic.row.workshops")}</dt>
            <dd className="font-semibold">{report.workshops}</dd>
            <dt>{t("ic.row.actions")}</dt>
            <dd className="font-semibold">
              {Object.entries(report.actions).length
                ? Object.entries(report.actions)
                    .map(([a, n]) => `${t(`ic.action.${a}` as MessageKey)}: ${n}`)
                    .join(", ")
                : t("ic.none")}
            </dd>
          </dl>
          <p className="pt-2 font-semibold">{t("ic.membersTitle")}</p>
          <ul className="list-disc pl-5">
            {report.members.map((m, i) => (
              <li key={i}>
                {m.name}, {t(`ic.role.${m.role}`)} ({dateLabel(m.termStart)} – {dateLabel(m.termEnd)})
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};

export default InternalCommittee;
