import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, CheckCircle2, ChevronRight, FileText, Footprints, HeartPulse, LifeBuoy, Map, MessageCircle, Phone, Radio, Timer, TriangleAlert, UserPlus } from "lucide-react";
import SetupChecklist from "@/components/SetupChecklist";
import RoutineReminder from "@/components/routines/RoutineReminder";
import FollowUpCard from "@/components/FollowUpCard";
import { DailyCheckInCard } from "@/components/DailyCheckIn";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/i18n";
import type { MessageKey } from "@/i18n/en";
import { api } from "@/lib/api";
import { offlineContacts, useOnline } from "@/lib/offline";
import { cn } from "@/lib/utils";
import type { Contact } from "@/pages/Contacts";

type Share = { id: number; kind?: "sos" | "walk"; expiresAt: string } | null;
type CheckIn = { id: number; dueAt: string; note: string | null } | null;
type Tool = { to: string; icon: typeof Timer; label: MessageKey; text: MessageKey };

// Grouped by when you'd reach for them, which also gives two rows that fill evenly.
const TOOL_GROUPS: Array<{ title: MessageKey; tools: Tool[] }> = [
  {
    title: "dash.toolsGoing",
    tools: [
      { to: "/walk", icon: Footprints, label: "nav.walk", text: "dash.walkText" },
      { to: "/timer", icon: Timer, label: "nav.timer", text: "dash.timerText" },
      { to: "/sos#fake-call", icon: Phone, label: "home.feature.fakeCallTitle", text: "dash.fakeCallText" },
      { to: "/map", icon: Map, label: "nav.map", text: "dash.mapText" },
    ],
  },
  {
    title: "dash.toolsAfter",
    tools: [
      { to: "/report", icon: FileText, label: "nav.report", text: "dash.reportText" },
      { to: "/support", icon: MessageCircle, label: "nav.support", text: "dash.supportText" },
      { to: "/help", icon: LifeBuoy, label: "nav.help", text: "dash.helpText" },
      { to: "/wellbeing", icon: HeartPulse, label: "nav.wellbeing", text: "dash.wellbeingText" },
    ],
  },
];

const greetingKey = (): MessageKey => {
  const h = new Date().getHours();
  return h < 12 ? "dash.morning" : h < 17 ? "dash.afternoon" : "dash.evening";
};

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// A running walk, SOS or timer: shown at the top, where it can't be missed.
const RunningCard = ({ to, icon: Icon, tone, title, text }: { to: string; icon: typeof Timer; tone: "success" | "primary"; title: string; text: string }) => (
  <Link
    to={to}
    className={cn(
      "group flex items-center gap-4 rounded-3xl bg-card p-5 shadow-card ring-1 transition-transform hover:-translate-y-0.5",
      tone === "success" ? "ring-success/40" : "ring-primary/30"
    )}
  >
    <span
      className={cn(
        "relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
        tone === "success" ? "bg-success/15 text-success" : "bg-primary/15 text-primary"
      )}
    >
      <Icon className="h-6 w-6" />
      {tone === "success" && <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-success motion-safe:animate-pulse" />}
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-lg font-bold">{title}</span>
      <span className="block text-muted-foreground">{text}</span>
    </span>
    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
  </Link>
);

// Home for signed-in users: SOS first, anything running right now, then everyday tools.
const Dashboard = () => {
  const { t, tn } = useI18n();
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [share, setShare] = useState<Share>(null);
  const [checkIn, setCheckIn] = useState<CheckIn>(null);
  const online = useOnline();

  useEffect(() => {
    api<{ contacts: Contact[] }>("/api/contacts")
      .then((r) => setContacts(r.contacts))
      // Offline: the copy kept on the device, so the page doesn't wrongly say nobody will be alerted.
      .catch(() => setContacts(offlineContacts.get<Contact>()));
    api<{ share: Share }>("/api/location-shares/active")
      .then((r) => setShare(r.share))
      .catch(() => {});
    api<{ checkIn: CheckIn }>("/api/check-ins/current")
      .then((r) => setCheckIn(r.checkIn))
      .catch(() => {});
  }, []);

  const confirmed = contacts?.filter((c) => c.status === "confirmed") ?? [];
  const ready = confirmed.length > 0;

  return (
    <main>
      {/* Greeting band, in the homepage's soft gradient. */}
      <section className="relative overflow-hidden pb-10 pt-28 md:pb-14 md:pt-36">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_70%_at_15%_0%,hsl(var(--primary)/0.14),transparent),radial-gradient(40%_60%_at_90%_10%,hsl(var(--brand)/0.10),transparent)]" />
        <div className="container relative mx-auto max-w-6xl space-y-5 px-4">
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-primary">{t(greetingKey())}</p>
          <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">{user?.name}</h1>
          {contacts !== null && (
            <p
              role="status"
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ring-1",
                ready ? "bg-success/10 text-foreground ring-success/30" : "bg-warning/15 text-foreground ring-warning/40"
              )}
            >
              {ready ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success" /> : <TriangleAlert className="h-4 w-4 shrink-0 text-warning" />}
              {ready ? tn("dash.status", confirmed.length) : t("dash.statusNotReady")}
            </p>
          )}
        </div>
      </section>

      <div className="container mx-auto max-w-6xl space-y-12 px-4 pb-24 md:space-y-16">
        {!online && (
          <p role="status" className="rounded-3xl bg-warning/10 p-5 ring-1 ring-warning/40">
            {t("sos.offline")}
          </p>
        )}

        {/* Anything running right now comes first. */}
        {(share || checkIn) && (
          <div className={cn("grid gap-4", share && checkIn && "md:grid-cols-2")}>
            {share && (
              <RunningCard
                to={share.kind === "walk" ? "/walk" : "/sos"}
                icon={Radio}
                tone="success"
                title={share.kind === "walk" ? t("live.walkTitle") : t("live.title")}
                text={t("dash.until", { time: time(share.expiresAt) })}
              />
            )}
            {checkIn && (
              <RunningCard to="/timer" icon={Timer} tone="primary" title={t("dash.timerRunning")} text={t("dash.checkInBy", { time: time(checkIn.dueAt) })} />
            )}
          </div>
        )}

        <DailyCheckInCard />
        <FollowUpCard />
        <RoutineReminder />

        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          {/* SOS */}
          <section className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-destructive to-[hsl(345_80%_45%)] p-8 text-white shadow-sos md:p-10">
            <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10" />
            <div aria-hidden className="pointer-events-none absolute -bottom-28 right-16 h-56 w-56 rounded-full bg-white/5" />
            <div className="relative flex h-full flex-col justify-between gap-8">
              <div className="space-y-3">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
                  <AlertCircle className="h-7 w-7" />
                </span>
                <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">{t("common.emergencySos")}</h2>
                <p className="max-w-md text-base leading-relaxed text-white md:text-lg">
                  {contacts === null ? " " : ready ? tn("dash.ready", confirmed.length) : t("dash.notReady")}
                </p>
              </div>
              <div className="space-y-4">
                <Link
                  to="/sos"
                  className="flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-8 py-5 text-xl font-extrabold text-[hsl(0_74%_42%)] shadow-lg transition-transform active:scale-[0.98] sm:w-auto sm:justify-start"
                >
                  <AlertCircle className="h-6 w-6" /> {t("dash.openSos")}
                </Link>
                {contacts !== null && !ready && (
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <TriangleAlert className="h-4 w-4 shrink-0" />
                    <Link to="/contacts" className="underline underline-offset-2">
                      {t("sos.contacts.manage")}
                    </Link>
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Contacts */}
          <section className="flex flex-col rounded-[2.5rem] bg-card p-8 shadow-card ring-1 ring-border md:p-10">
            <div className="mb-6 flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold md:text-2xl">{t("dash.contactsTitle")}</h2>
              <Link to="/contacts" className="shrink-0 text-sm font-semibold text-primary underline-offset-2 hover:underline">
                {t("dash.manage")}
              </Link>
            </div>
            {contacts === null ? (
              <div className="h-24 animate-pulse rounded-2xl bg-muted" />
            ) : contacts.length === 0 ? (
              <Link to="/contacts" className="flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-8 text-center text-muted-foreground transition-colors hover:border-primary/50">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <UserPlus className="h-6 w-6" />
                </span>
                {t("dash.noContacts")}
              </Link>
            ) : (
              <ul className="space-y-4">
                {contacts.slice(0, 4).map((c) => (
                  <li key={c.id} className="flex items-center gap-4">
                    <span
                      aria-hidden
                      className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base font-bold",
                        c.status === "confirmed" ? "bg-success/15 text-success" : "bg-warning/15 text-foreground"
                      )}
                    >
                      {c.name.trim().charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-lg font-semibold">{c.name}</span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-3 py-1 text-xs font-semibold",
                        c.status === "confirmed" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                      )}
                    >
                      {t(c.status === "confirmed" ? "contacts.status.confirmed" : c.status === "pending" ? "contacts.status.pending" : "contacts.status.declined")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <SetupChecklist className="rounded-[2rem] border-primary/20 shadow-card" />

        {TOOL_GROUPS.map((group) => (
          <section key={group.title} className="space-y-5">
            <h2 className="text-2xl font-extrabold tracking-tight md:text-3xl">{t(group.title)}</h2>
            {/* Emergency contraception and HIV medicine work only within 72 hours: a direct way in. */}
            {group.title === "dash.toolsAfter" && (
              <Link
                to="/help#after-assault"
                className="flex items-center justify-between gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm font-semibold hover:bg-destructive/10"
              >
                {t("help.afterAssaultLink")}
                <ChevronRight className="h-4 w-4 shrink-0" />
              </Link>
            )}
            <div className={cn("grid gap-4 sm:grid-cols-2", group.tools.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
              {group.tools.map(({ to, icon: Icon, label, text }) => (
                <Link
                  key={to}
                  to={to}
                  className="group flex items-center gap-4 rounded-3xl bg-card p-5 shadow-card ring-1 ring-border transition-all hover:-translate-y-0.5 hover:ring-primary/40 sm:flex-col sm:items-start sm:gap-5 sm:p-6"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-brand text-white shadow-raised">
                    <Icon className="h-6 w-6" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg font-bold leading-tight">{t(label)}</span>
                    <span className="mt-1 block text-muted-foreground">{t(text)}</span>
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 sm:hidden" />
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
};

export default Dashboard;
