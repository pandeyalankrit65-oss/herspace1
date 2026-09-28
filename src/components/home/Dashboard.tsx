import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ChevronRight, FileText, Footprints, Map, MessageCircle, LifeBuoy, Phone, Radio, Timer, TriangleAlert, Users } from "lucide-react";
import SetupChecklist from "@/components/SetupChecklist";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/i18n";
import type { MessageKey } from "@/i18n/en";
import { api } from "@/lib/api";
import { offlineContacts, useOnline } from "@/lib/offline";
import { cn } from "@/lib/utils";
import type { Contact } from "@/pages/Contacts";

type Share = { id: number; kind?: "sos" | "walk"; expiresAt: string } | null;
type CheckIn = { id: number; dueAt: string; note: string | null } | null;

const ACTIONS: Array<{ to: string; icon: typeof Timer; label: MessageKey; text: MessageKey }> = [
  { to: "/walk", icon: Footprints, label: "nav.walk", text: "dash.walkText" },
  { to: "/timer", icon: Timer, label: "nav.timer", text: "dash.timerText" },
  { to: "/sos#fake-call", icon: Phone, label: "home.feature.fakeCallTitle", text: "dash.fakeCallText" },
  { to: "/map", icon: Map, label: "nav.map", text: "dash.mapText" },
  { to: "/report", icon: FileText, label: "nav.report", text: "dash.reportText" },
  { to: "/support", icon: MessageCircle, label: "nav.support", text: "dash.supportText" },
  { to: "/help", icon: LifeBuoy, label: "nav.help", text: "dash.helpText" },
];

const greetingKey = (): MessageKey => {
  const h = new Date().getHours();
  return h < 12 ? "dash.morning" : h < 17 ? "dash.afternoon" : "dash.evening";
};

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

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

  return (
    <main className="px-4 pb-16 pt-24">
      <div className="container mx-auto max-w-5xl space-y-6">
        <header>
          <p className="text-sm font-semibold text-muted-foreground">{t(greetingKey())}</p>
          <h1 className="text-3xl font-extrabold sm:text-4xl">{user?.name}</h1>
        </header>

        {!online && (
          <p role="status" className="rounded-2xl border border-warning/50 bg-warning/10 p-4 text-sm">
            {t("sos.offline")}
          </p>
        )}

        {/* Anything running right now comes first. */}
        {(share || checkIn) && (
          <div className="space-y-3">
            {share && (
              <Link
                to={share.kind === "walk" ? "/walk" : "/sos"}
                className="flex items-center gap-3 rounded-2xl border border-success/40 bg-success/10 p-4"
              >
                <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success/20 text-success">
                  <Radio className="h-5 w-5" />
                  <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-success motion-safe:animate-pulse" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{share.kind === "walk" ? t("live.walkTitle") : t("live.title")}</span>
                  <span className="block text-sm text-muted-foreground">{t("dash.until", { time: time(share.expiresAt) })}</span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
              </Link>
            )}
            {checkIn && (
              <Link to="/timer" className="flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Timer className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{t("dash.timerRunning")}</span>
                  <span className="block text-sm text-muted-foreground">{t("dash.checkInBy", { time: time(checkIn.dueAt) })}</span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
              </Link>
            )}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
          {/* SOS */}
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-destructive to-[hsl(345_80%_45%)] p-6 text-white shadow-sos sm:p-8">
            <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10" />
            <div aria-hidden className="pointer-events-none absolute -bottom-24 right-10 h-48 w-48 rounded-full bg-white/5" />
            <div className="relative space-y-5">
              <div>
                <h2 className="text-2xl font-extrabold">{t("common.emergencySos")}</h2>
                <p className="mt-1 max-w-sm text-sm text-white">
                  {contacts === null
                    ? " "
                    : confirmed.length > 0
                      ? tn("dash.ready", confirmed.length)
                      : t("dash.notReady")}
                </p>
              </div>
              <Link
                to="/sos"
                className="flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-6 py-4 text-lg font-extrabold text-[hsl(0_74%_42%)] shadow-lg transition-transform active:scale-[0.98] sm:w-auto sm:justify-start"
              >
                <AlertCircle className="h-6 w-6" /> {t("dash.openSos")}
              </Link>
              {contacts !== null && confirmed.length === 0 && (
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <TriangleAlert className="h-4 w-4 shrink-0" />
                  <Link to="/contacts" className="underline underline-offset-2">
                    {t("sos.contacts.manage")}
                  </Link>
                </p>
              )}
            </div>
          </section>

          {/* Contacts */}
          <section className="rounded-3xl border bg-card p-6 shadow-card">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold">{t("dash.contactsTitle")}</h2>
              <Link to="/contacts" className="text-sm font-semibold text-primary underline-offset-2 hover:underline">
                {t("dash.manage")}
              </Link>
            </div>
            {contacts === null ? (
              <div className="h-16 animate-pulse rounded-xl bg-muted" />
            ) : contacts.length === 0 ? (
              <Link to="/contacts" className="flex items-center gap-3 rounded-xl border border-dashed p-4 text-sm text-muted-foreground hover:border-primary/50">
                <Users className="h-5 w-5 text-primary" /> {t("dash.noContacts")}
              </Link>
            ) : (
              <ul className="space-y-3">
                {contacts.slice(0, 4).map((c) => (
                  <li key={c.id} className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                        c.status === "confirmed" ? "bg-success/15 text-success" : "bg-warning/15"
                      )}
                    >
                      {c.name.trim().charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
                    <span className={cn("text-xs font-semibold", c.status === "confirmed" ? "text-success" : "text-muted-foreground")}>
                      {t(c.status === "confirmed" ? "contacts.status.confirmed" : c.status === "pending" ? "contacts.status.pending" : "contacts.status.declined")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <SetupChecklist />

        <section>
          <h2 className="mb-3 text-lg font-bold">{t("dash.toolsTitle")}</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {ACTIONS.map(({ to, icon: Icon, label, text }) => (
              <Link
                key={to}
                to={to}
                className="group flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/40 sm:flex-row sm:items-center"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-brand/15 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block font-bold leading-tight">{t(label)}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground sm:text-sm">{t(text)}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
};

export default Dashboard;
