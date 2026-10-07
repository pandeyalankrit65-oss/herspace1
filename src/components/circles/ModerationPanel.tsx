import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, EyeOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import CodeBox from "@/components/CodeBox";
import { postKindKey, reasonKey, roleKey, when, type Moderation, type Role } from "./types";

// For a circle's owner and moderators: join requests, flagged posts and comments, and members.
const ModerationPanel = ({ circleId, role, onChange }: { circleId: number; role: Role; onChange: () => void }) => {
  const { t, tn } = useI18n();
  const { toast } = useToast();
  const [data, setData] = useState<Moderation | null>(null);
  const [code, setCode] = useState<string | null>(null);

  const load = useCallback(() => {
    api<Moderation>(`/api/circles/${circleId}/moderation`)
      .then(setData)
      .catch(() => {});
  }, [circleId]);
  useEffect(load, [load]);

  const run = async (path: string, body: unknown, done: string) => {
    try {
      await api(`/api/circles/${circleId}/${path}`, { body });
      toast({ title: done });
      load();
      onChange();
    } catch (err) {
      toast({ title: t("circles.actionFailed"), description: (err as Error).message, variant: "destructive" });
    }
  };

  if (!data) return <div className="h-48 animate-pulse rounded-3xl bg-muted" />;
  const amOwner = role === "owner";
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-xl font-extrabold">{t("circles.modRequests")}</h2>
        {data.requests.length === 0 ? (
          <p className="text-muted-foreground">{t("circles.modNoRequests")}</p>
        ) : (
          data.requests.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-card p-4 shadow-card ring-1 ring-border">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 font-semibold">
                  {r.name}
                  {r.verified && <BadgeCheck className="h-4 w-4 text-success" aria-label={t("circles.verifiedEmail")} />}
                </p>
                <p className="text-sm text-muted-foreground">{t("circles.askedOn", { date: when(r.at) })}</p>
              </div>
              <Button
                type="button"
                variant="hero"
                size="sm"
                onClick={() => run(`moderation/requests/${r.id}`, { approve: true }, t("circles.approved"))}
              >
                {t("circles.approve")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => run(`moderation/requests/${r.id}`, { approve: false }, t("circles.declined"))}
              >
                {t("circles.decline")}
              </Button>
            </div>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-extrabold">{t("circles.modFlagged")}</h2>
        {data.flagged.length === 0 ? (
          <p className="text-muted-foreground">{t("circles.modNoFlagged")}</p>
        ) : (
          data.flagged.map((f) => (
            <article key={`${f.target}-${f.id}`} className="space-y-3 rounded-3xl bg-card p-5 shadow-card ring-1 ring-border">
              <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {f.target === "post" && f.kind ? t(postKindKey(f.kind)) : t("circles.aComment")}
                </span>
                ·
                <span className="inline-flex items-center gap-1">
                  {f.author ?? (
                    <>
                      <EyeOff className="h-3.5 w-3.5" /> {t("circles.anonymousMember")}
                    </>
                  )}
                </span>
                · {when(f.at)}
              </p>
              <p className="whitespace-pre-wrap break-words">{f.body}</p>
              <p className="text-sm">
                <span className="font-semibold">{tn("circles.flagCount", f.flags)}</span>{" "}
                <span className="text-muted-foreground">{f.reasons.map((r) => t(reasonKey(r))).join(", ")}</span>
                {f.hidden && <span className="text-muted-foreground"> · {t("circles.hiddenNow")}</span>}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="glass"
                  size="sm"
                  onClick={() => run("moderation/items", { target: f.target, id: f.id, action: "keep" }, t("circles.kept"))}
                >
                  {t("circles.keep")}
                </Button>
                <Button
                  type="button"
                  variant="glass"
                  size="sm"
                  onClick={() => run("moderation/items", { target: f.target, id: f.id, action: "remove" }, t("circles.deleted"))}
                >
                  {t("circles.remove")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => run("moderation/items", { target: f.target, id: f.id, action: "remove", ban: true }, t("circles.removedBanned"))}
                >
                  {t("circles.removeBan")}
                </Button>
              </div>
            </article>
          ))
        )}
        <p className="text-sm text-muted-foreground">{t("circles.modAnonNote")}</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-extrabold">{t("circles.modMembers", { count: data.members.length })}</h2>
        <ul className="divide-y divide-border rounded-3xl bg-card shadow-card ring-1 ring-border">
          {data.members.map((m) => {
            const canAct = m.role === "member" || (amOwner && m.role === "moderator");
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 font-semibold">
                    {m.name}
                    {m.verified && <BadgeCheck className="h-4 w-4 text-success" aria-label={t("circles.verifiedEmail")} />}
                  </p>
                  <p className="text-sm text-muted-foreground">{t(roleKey(m.role))}</p>
                </div>
                {canAct && (
                  <div className="flex flex-wrap gap-1">
                    {amOwner && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          run(`moderation/members/${m.id}`, { action: m.role === "member" ? "moderator" : "member" }, t("circles.roleChanged"))
                        }
                      >
                        {m.role === "member" ? t("circles.makeModerator") : t("circles.makeMember")}
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => run(`moderation/members/${m.id}`, { action: "remove" }, t("circles.memberRemoved"))}
                    >
                      {t("circles.removeMember")}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => run(`moderation/members/${m.id}`, { action: "ban" }, t("circles.memberBanned"))}
                    >
                      {t("circles.ban")}
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-3 rounded-3xl bg-card p-6 shadow-card ring-1 ring-border">
        <h2 className="text-xl font-extrabold">{t("circles.codeSection")}</h2>
        <p className="text-sm text-muted-foreground">{t("circles.codeSectionText")}</p>
        {code && <CodeBox code={code} label={t("circles.code")} />}
        <Button
          type="button"
          variant="glass"
          className="gap-2"
          onClick={() =>
            api<{ joinCode: string }>(`/api/circles/${circleId}/join-code`, { method: "POST" })
              .then((r) => setCode(r.joinCode))
              .catch((err: Error) => toast({ title: t("circles.actionFailed"), description: err.message, variant: "destructive" }))
          }
        >
          <RefreshCw className="h-4 w-4" /> {t("circles.newCode")}
        </Button>
      </section>
    </div>
  );
};

export default ModerationPanel;
