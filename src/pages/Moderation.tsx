import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { EyeOff, Flag, ShieldCheck } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PageHeader from "@/components/PageHeader";
import LoadingRows from "@/components/LoadingRows";
import ReportPhotos from "@/components/ReportPhotos";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/i18n";
import type { MessageKey } from "@/i18n/en";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type Queue = "review" | "approved" | "removed";
type Action = "approve" | "remove" | "reopen";
type ModReport = {
  id: number;
  incidentType: string;
  description: string;
  lat: number;
  lng: number;
  date: string;
  status: string;
  flags: number;
  hidden: boolean;
  photos: number[];
};

const QUEUES: Array<{ id: Queue; label: MessageKey }> = [
  { id: "review", label: "mod.queue.review" },
  { id: "approved", label: "mod.queue.approved" },
  { id: "removed", label: "mod.queue.removed" },
];

const ACTIONS: Record<Queue, Array<{ action: Action; label: MessageKey; variant: "hero" | "outline" | "destructive" }>> = {
  review: [
    { action: "approve", label: "mod.approve", variant: "outline" },
    { action: "remove", label: "mod.remove", variant: "destructive" },
  ],
  approved: [
    { action: "remove", label: "mod.remove", variant: "destructive" },
    { action: "reopen", label: "mod.reopen", variant: "outline" },
  ],
  removed: [
    { action: "approve", label: "mod.approve", variant: "outline" },
    { action: "reopen", label: "mod.reopen", variant: "outline" },
  ],
};

const DONE: Record<Action, MessageKey> = { approve: "mod.approved", remove: "mod.removed", reopen: "mod.reopened" };

const REPORT_TYPES = ["harassment", "assault", "stalking", "threat", "discrimination", "other"];

// Review queue for Safe Map points that people flagged. Moderators only.
const Moderation = () => {
  const { t, tn } = useI18n();
  const { toast } = useToast();
  const { user, loading } = useAuth();
  const [queue, setQueue] = useState<Queue>("review");
  const [reports, setReports] = useState<ModReport[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(() => {
    setReports(null);
    api<{ reports: ModReport[] }>(`/api/moderation/reports?queue=${queue}`)
      .then((res) => setReports(res.reports))
      .catch(() => setReports([]));
  }, [queue]);

  useEffect(() => {
    if (user?.moderator) load();
  }, [user, load]);

  const act = async (id: number, action: Action) => {
    setBusy(id);
    try {
      await api(`/api/moderation/reports/${id}`, { body: { action } });
      setReports((prev) => prev?.filter((r) => r.id !== id) ?? null);
      toast({ title: t(DONE[action]) });
    } catch (err) {
      toast({ title: t("mod.failed"), description: (err as Error).message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const body = () => {
    if (loading) return <LoadingRows tall />;
    if (!user?.moderator) {
      return (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <p className="text-muted-foreground">{t("mod.forbidden")}</p>
            {!user && (
              <Link to="/login?next=/moderation" className="font-semibold text-primary underline">
                {t("common.logIn")}
              </Link>
            )}
          </CardContent>
        </Card>
      );
    }
    return (
      <>
        <div role="tablist" aria-label={t("mod.title")} className="flex gap-1 rounded-xl border bg-muted/50 p-1">
          {QUEUES.map((q) => (
            <button
              key={q.id}
              role="tab"
              type="button"
              aria-selected={queue === q.id}
              onClick={() => setQueue(q.id)}
              className={cn(
                "flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                queue === q.id ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t(q.label)}
            </button>
          ))}
        </div>
        <div role="tabpanel" className="space-y-3">
          {reports === null && <LoadingRows rows={2} tall />}
          {reports?.length === 0 && <p className="py-8 text-center text-muted-foreground">{t("mod.empty")}</p>}
          {reports?.map((r) => (
            <Card key={r.id} role="article" aria-labelledby={`mod-report-${r.id}`}>
              <CardContent className="space-y-3 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 id={`mod-report-${r.id}`} className="font-bold">
                    {REPORT_TYPES.includes(r.incidentType) ? t(`report.types.${r.incidentType}` as MessageKey) : r.incidentType}
                  </h2>
                  <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-semibold">
                    <Flag className="h-3 w-3" /> {tn("mod.flags", r.flags)}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                      r.hidden ? "bg-destructive/10 text-destructive" : "bg-success/15"
                    )}
                  >
                    {r.hidden ? <EyeOff className="h-3 w-3" /> : null}
                    {r.hidden ? t("mod.hidden") : t("mod.onMap")}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(r.date).toLocaleDateString()} · {t("mod.area", { lat: r.lat, lng: r.lng })}
                </p>
                <p className="whitespace-pre-wrap text-sm">{r.description}</p>
                <ReportPhotos reportId={r.id} photos={r.photos} />
                <div className="flex flex-wrap gap-2 pt-1">
                  {ACTIONS[queue].map((a) => (
                    <Button key={a.action} size="sm" variant={a.variant} disabled={busy === r.id} onClick={() => act(r.id, a.action)}>
                      {t(a.label)}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </>
    );
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="px-4 pb-16 pt-24">
        <div className="container mx-auto max-w-3xl space-y-4">
          <PageHeader icon={ShieldCheck} title={t("mod.title")} subtitle={t("mod.intro")} />
          {body()}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Moderation;
