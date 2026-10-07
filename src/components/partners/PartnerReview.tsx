import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { LANGUAGE_NAMES, feesKey, kindKey, statusKey, type PartnerFull } from "./types";

type Status = PartnerFull["status"];
const STATUSES: Status[] = ["pending", "approved", "rejected", "hidden"];

// HerSpace moderators check partner applications before anyone is listed: the credentials can
// be verified with the issuing body (e.g. Bar Council, RCI, NGO Darpan) before approving.
const PartnerReview = () => {
  const { t } = useI18n();
  const { toast } = useToast();
  const [status, setStatus] = useState<Status>("pending");
  const [partners, setPartners] = useState<PartnerFull[] | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});

  const load = useCallback(() => {
    setPartners(null);
    api<{ partners: PartnerFull[] }>(`/api/moderation/partners?status=${status}`)
      .then((r) => setPartners(r.partners))
      .catch(() => setPartners([]));
  }, [status]);
  useEffect(load, [load]);

  const decide = async (id: number, action: "approve" | "reject" | "hide") => {
    try {
      await api(`/api/moderation/partners/${id}`, { body: { action, note: notes[id] || undefined } });
      toast({ title: t("partners.mod.done") });
      load();
    } catch (err) {
      toast({ title: t("mod.failed"), description: (err as Error).message, variant: "destructive" });
    }
  };

  return (
    <section className="space-y-4 pt-8">
      <div>
        <h2 className="text-2xl font-extrabold">{t("partners.mod.title")}</h2>
        <p className="text-muted-foreground">{t("partners.mod.intro")}</p>
      </div>
      <div role="tablist" aria-label={t("partners.mod.title")} className="flex gap-1 rounded-xl border bg-muted/50 p-1">
        {STATUSES.map((s) => (
          <button
            key={s}
            role="tab"
            type="button"
            aria-selected={status === s}
            onClick={() => setStatus(s)}
            className={cn(
              "flex-1 rounded-lg px-2 py-2 text-sm font-semibold transition-colors",
              status === s ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(statusKey(s))}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="space-y-3">
        {partners === null && <div className="h-32 animate-pulse rounded-2xl bg-muted" />}
        {partners?.length === 0 && <p className="py-8 text-center text-muted-foreground">{t("mod.empty")}</p>}
        {partners?.map((p) => (
          <Card key={p.id} role="article" aria-labelledby={`partner-${p.id}`}>
            <CardContent className="space-y-3 p-5">
              <div>
                <h3 id={`partner-${p.id}`} className="text-lg font-bold">
                  {p.name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t(kindKey(p.kind))} · {p.city} · {p.languages.map((l) => (l === "other" ? t("partners.langOther") : LANGUAGE_NAMES[l])).join(", ")}{" "}
                  · {t(feesKey(p.fees))}
                </p>
              </div>
              <p className="whitespace-pre-wrap text-sm">{p.description}</p>
              <dl className="grid gap-x-4 gap-y-1 rounded-xl bg-muted/60 p-3 text-sm sm:grid-cols-[auto_1fr]">
                <dt className="font-semibold">{t("partners.f.credentials")}</dt>
                <dd className="whitespace-pre-wrap">{p.credentials}</dd>
                <dt className="font-semibold">{t("partners.f.email")}</dt>
                <dd>{p.email}</dd>
                {p.phone && (
                  <>
                    <dt className="font-semibold">{t("partners.f.phone")}</dt>
                    <dd>{p.phone}</dd>
                  </>
                )}
                {p.website && (
                  <>
                    <dt className="font-semibold">{t("partners.f.website")}</dt>
                    <dd className="break-all">{p.website}</dd>
                  </>
                )}
                <dt className="font-semibold">{t("partners.mod.account")}</dt>
                <dd>{p.accountEmail}</dd>
              </dl>
              {p.reviewNote && (
                <p className="text-sm">
                  <span className="font-semibold">{t("partners.reviewNote")}</span> {p.reviewNote}
                </p>
              )}
              <div className="space-y-2">
                <label htmlFor={`note-${p.id}`} className="sr-only">
                  {t("partners.mod.note")}
                </label>
                <Input
                  id={`note-${p.id}`}
                  value={notes[p.id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [p.id]: e.target.value }))}
                  placeholder={t("partners.mod.note")}
                  maxLength={500}
                />
                <div className="flex flex-wrap gap-2">
                  {p.status !== "approved" && (
                    <Button size="sm" variant="outline" onClick={() => decide(p.id, "approve")}>
                      {t("partners.mod.approve")}
                    </Button>
                  )}
                  {p.status === "pending" && (
                    <Button size="sm" variant="destructive" disabled={!notes[p.id]} onClick={() => decide(p.id, "reject")}>
                      {t("partners.mod.reject")}
                    </Button>
                  )}
                  {p.status === "approved" && (
                    <Button size="sm" variant="destructive" disabled={!notes[p.id]} onClick={() => decide(p.id, "hide")}>
                      {t("partners.mod.hide")}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
};

export default PartnerReview;
