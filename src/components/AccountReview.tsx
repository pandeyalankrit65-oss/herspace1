import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, Mail, Smartphone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import type { MessageKey } from "@/i18n/en";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type Account = {
  id: number;
  name: string;
  createdAt: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  suspendedAt: string | null;
  suspendedReason: string | null;
  signals: string[];
  stats: { reports: number; held: number; removed: number; flaggers: number };
};
type View = "review" | "suspended";

// Accounts whose Safe Map activity looks like misuse, by pseudonym: moderators never learn who
// sent a report. Pausing an account only affects the map; SOS keeps working for them.
const AccountReview = () => {
  const { t, tn } = useI18n();
  const { toast } = useToast();
  const [view, setView] = useState<View>("review");
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [reasons, setReasons] = useState<Record<number, string>>({});

  const load = useCallback(() => {
    setAccounts(null);
    api<{ accounts: Account[] }>(`/api/moderation/accounts?view=${view}`)
      .then((r) => setAccounts(r.accounts))
      .catch(() => setAccounts([]));
  }, [view]);
  useEffect(load, [load]);

  const act = async (id: number, action: "suspend" | "unsuspend" | "clear") => {
    try {
      await api(`/api/moderation/accounts/${id}`, { body: { action, reason: reasons[id] || undefined } });
      toast({ title: t(`accounts.done.${action}` as MessageKey) });
      load();
    } catch (err) {
      toast({ title: t("mod.failed"), description: (err as Error).message, variant: "destructive" });
    }
  };

  return (
    <section className="space-y-4 pt-8">
      <div>
        <h2 className="text-2xl font-extrabold">{t("accounts.title")}</h2>
        <p className="text-muted-foreground">{t("accounts.intro")}</p>
      </div>
      <div role="tablist" aria-label={t("accounts.title")} className="flex gap-1 rounded-xl border bg-muted/50 p-1">
        {(["review", "suspended"] as const).map((v) => (
          <button
            key={v}
            role="tab"
            type="button"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={cn(
              "flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
              view === v ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {v === "review" ? t("accounts.toReview") : t("accounts.paused")}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="space-y-3">
        {accounts === null && <div className="h-24 animate-pulse rounded-2xl bg-muted" />}
        {accounts?.length === 0 && <p className="py-8 text-center text-muted-foreground">{t("mod.empty")}</p>}
        {accounts?.map((a) => (
          <Card key={a.id} role="article" aria-labelledby={`account-${a.id}`}>
            <CardContent className="space-y-3 p-5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h3 id={`account-${a.id}`} className="font-mono text-lg font-bold">
                  {t("accounts.name", { name: a.name })}
                </h3>
                <span className="text-sm text-muted-foreground">{t("accounts.joined", { date: new Date(a.createdAt).toLocaleDateString() })}</span>
                <span className={cn("inline-flex items-center gap-1 text-sm", a.emailVerified ? "text-foreground" : "text-muted-foreground")}>
                  {a.emailVerified ? <BadgeCheck className="h-4 w-4 text-success" /> : <Mail className="h-4 w-4" />}
                  {a.emailVerified ? t("accounts.emailVerified") : t("accounts.emailNot")}
                </span>
                <span className={cn("inline-flex items-center gap-1 text-sm", a.phoneVerified ? "text-foreground" : "text-muted-foreground")}>
                  {a.phoneVerified ? <BadgeCheck className="h-4 w-4 text-success" /> : <Smartphone className="h-4 w-4" />}
                  {a.phoneVerified ? t("accounts.phoneVerified") : t("accounts.phoneNot")}
                </span>
              </div>
              <p className="text-sm">
                {tn("accounts.reports", a.stats.reports)} · {t("accounts.held", { count: a.stats.held })} ·{" "}
                {t("accounts.removed", { count: a.stats.removed })} · {t("accounts.flaggers", { count: a.stats.flaggers })}
              </p>
              {a.signals.length > 0 && (
                <ul className="list-disc space-y-0.5 pl-5 text-sm">
                  {a.signals.map((s) => (
                    <li key={s}>{t(`accounts.signal.${s}` as MessageKey)}</li>
                  ))}
                </ul>
              )}
              {a.suspendedReason && (
                <p className="text-sm">
                  <span className="font-semibold">{t("accounts.pausedBecause")}</span> {a.suspendedReason}
                </p>
              )}
              {view === "review" ? (
                <div className="space-y-2">
                  <label htmlFor={`reason-${a.id}`} className="sr-only">
                    {t("accounts.reason")}
                  </label>
                  <Input
                    id={`reason-${a.id}`}
                    value={reasons[a.id] ?? ""}
                    onChange={(e) => setReasons((r) => ({ ...r, [a.id]: e.target.value }))}
                    placeholder={t("accounts.reason")}
                    maxLength={300}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => act(a.id, "clear")}>
                      {t("accounts.clear")}
                    </Button>
                    <Button size="sm" variant="destructive" disabled={!reasons[a.id]} onClick={() => act(a.id, "suspend")}>
                      {t("accounts.suspend")}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => act(a.id, "unsuspend")}>
                  {t("accounts.unsuspend")}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
};

export default AccountReview;
