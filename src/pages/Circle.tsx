import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BadgeCheck, MessagesSquare, Settings as SettingsIcon, ShieldCheck, Users } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CodeBox from "@/components/CodeBox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import Feed, { Composer } from "@/components/circles/Feed";
import ModerationPanel from "@/components/circles/ModerationPanel";
import { kindKey, roleKey, type CircleView, type Post } from "@/components/circles/types";

const SettingsPanel = ({ view, onSaved }: { view: CircleView["circle"]; onSaved: () => void }) => {
  const { t } = useI18n();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState(view.name);
  const [description, setDescription] = useState(view.description);
  const [listed, setListed] = useState(view.listed);
  const [requireDomain, setRequireDomain] = useState(view.requireDomain);
  const owner = view.role === "owner";

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api(`/api/circles/${view.id}`, { method: "PUT", body: { name, description, listed, requireDomain } });
      toast({ title: t("circles.saved") });
      onSaved();
    } catch (err) {
      toast({ title: t("circles.actionFailed"), description: (err as Error).message, variant: "destructive" });
    }
  };
  const leave = async () => {
    try {
      await api(`/api/circles/${view.id}/leave`, { method: "POST" });
      navigate("/circles");
    } catch (err) {
      toast({ title: t("circles.actionFailed"), description: (err as Error).message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      {owner && (
        <form onSubmit={save} className="space-y-4 rounded-3xl bg-card p-6 shadow-card ring-1 ring-border">
          <h2 className="text-xl font-extrabold">{t("circles.settingsTitle")}</h2>
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">{t("circles.name")}</Label>
            <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-description">{t("circles.description")}</Label>
            <Textarea id="edit-description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
          </div>
          {view.emailDomain && (
            <div className="flex items-start justify-between gap-4 rounded-2xl bg-muted/60 p-4">
              <label htmlFor="edit-require" className="text-sm">
                <span className="font-semibold">{t("circles.requireDomain", { domain: view.emailDomain })}</span>
                <span className="block text-muted-foreground">{t("circles.requireDomainHint")}</span>
              </label>
              <Switch id="edit-require" checked={requireDomain} onCheckedChange={setRequireDomain} />
            </div>
          )}
          <div className="flex items-start justify-between gap-4 rounded-2xl bg-muted/60 p-4">
            <label htmlFor="edit-listed" className="text-sm">
              <span className="font-semibold">{t("circles.listed")}</span>
              <span className="block text-muted-foreground">{t("circles.listedHint")}</span>
            </label>
            <Switch id="edit-listed" checked={listed} onCheckedChange={setListed} />
          </div>
          <Button type="submit" variant="hero">
            {t("circles.save")}
          </Button>
        </form>
      )}
      <section className="space-y-3 rounded-3xl bg-card p-6 shadow-card ring-1 ring-border">
        <h2 className="text-xl font-extrabold">{t("circles.leaveTitle")}</h2>
        <p className="text-sm text-muted-foreground">{owner ? t("circles.leaveOwner") : t("circles.leaveText")}</p>
        <Button type="button" variant="glass" className="text-destructive" onClick={leave}>
          {t("circles.leave")}
        </Button>
      </section>
      <p className="rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">{t("circles.privacyNote")}</p>
    </div>
  );
};

const Circle = () => {
  const { t, tn } = useI18n();
  const { id } = useParams();
  const location = useLocation();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<CircleView | null>(null);
  const [older, setOlder] = useState<Post[]>([]);
  const [more, setMore] = useState(false);
  const [missing, setMissing] = useState(false);
  const newCode = (location.state as { joinCode?: string } | null)?.joinCode;

  const load = useCallback(() => {
    api<CircleView>(`/api/circles/${id}`)
      .then((v) => {
        setView(v);
        setOlder([]);
        setMore(v.more);
      })
      .catch(() => setMissing(true));
  }, [id]);
  useEffect(() => {
    if (!loading && !user) navigate(`/login?next=/circles/${id}`, { replace: true });
    else if (user) load();
  }, [user, loading, load, navigate, id]);

  const loadOlder = async () => {
    const all = [...(view?.posts ?? []), ...older];
    const res = await api<CircleView>(`/api/circles/${id}?before=${all[all.length - 1].id}`);
    setOlder((o) => [...o, ...res.posts]);
    setMore(res.more);
  };

  const c = view?.circle;
  const canModerate = c?.role === "owner" || c?.role === "moderator";

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="px-4 pb-24 pt-28 md:pt-36">
        <div className="container mx-auto max-w-3xl space-y-8">
          <Link to="/circles" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> {t("circles.back")}
          </Link>
          {missing ? (
            <div className="space-y-3 rounded-3xl bg-card p-8 text-center shadow-card ring-1 ring-border">
              <h1 className="text-2xl font-extrabold">{t("circles.notFound")}</h1>
              <p className="text-muted-foreground">{t("circles.notFoundText")}</p>
            </div>
          ) : !view || !c ? (
            <div className="h-64 animate-pulse rounded-[2rem] bg-muted" />
          ) : (
            <>
              <header className="space-y-4 rounded-[2rem] bg-card p-6 shadow-card ring-1 ring-border sm:p-8">
                <div className="flex items-start gap-4">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-brand text-white shadow-raised">
                    <Users className="h-7 w-7" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{c.name}</h1>
                    <p className="text-sm text-muted-foreground">
                      {t(kindKey(c.kind))} · {tn("circles.memberCount", c.members)}
                      {c.role !== "member" && <> · {t(roleKey(c.role))}</>}
                    </p>
                  </div>
                </div>
                <p className="text-muted-foreground">{c.description}</p>
                {c.emailDomain && (
                  <p className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1.5 text-sm font-semibold ring-1 ring-success/30">
                    <BadgeCheck className="h-4 w-4 text-success" />
                    {c.requireDomain ? t("circles.onlyDomain", { domain: c.emailDomain }) : t("circles.verifiedDomain", { domain: c.emailDomain })}
                  </p>
                )}
              </header>

              {newCode && (
                <section className="space-y-3 rounded-[2rem] bg-card p-6 shadow-card ring-1 ring-success/40 sm:p-8">
                  <h2 className="text-xl font-extrabold">{t("circles.codeTitle")}</h2>
                  <p className="text-muted-foreground">{t("circles.codeText")}</p>
                  <CodeBox code={newCode} label={t("circles.code")} />
                </section>
              )}

              <Tabs defaultValue="posts" className="space-y-6">
                <TabsList
                  className={`grid h-auto w-full gap-1 rounded-2xl p-1.5 sm:inline-flex sm:w-auto ${canModerate ? "grid-cols-3" : "grid-cols-2"}`}
                >
                  <TabsTrigger value="posts" className="gap-2 rounded-xl px-3 py-2 sm:px-4">
                    <MessagesSquare className="h-4 w-4" /> {t("circles.tabPosts")}
                  </TabsTrigger>
                  {canModerate && (
                    <TabsTrigger value="moderation" className="gap-2 rounded-xl px-3 py-2 sm:px-4">
                      <ShieldCheck className="h-4 w-4" /> {t("circles.tabModeration")}
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="settings" className="gap-2 rounded-xl px-3 py-2 sm:px-4">
                    <SettingsIcon className="h-4 w-4" /> {t("circles.tabSettings")}
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="posts" className="space-y-6">
                  <Composer circleId={c.id} onPosted={load} />
                  <Feed circleId={c.id} posts={[...view.posts, ...older]} canModerate={canModerate} onChange={load} />
                  {more && (
                    <div className="text-center">
                      <Button type="button" variant="glass" onClick={loadOlder}>
                        {t("circles.older")}
                      </Button>
                    </div>
                  )}
                  <p className="text-center text-sm text-muted-foreground">
                    {t("circles.emergency")}{" "}
                    <Link to="/sos" className="font-semibold text-destructive underline underline-offset-2">
                      {t("common.emergencySos")}
                    </Link>
                  </p>
                </TabsContent>
                {canModerate && (
                  <TabsContent value="moderation">
                    <ModerationPanel circleId={c.id} role={c.role} onChange={load} />
                  </TabsContent>
                )}
                <TabsContent value="settings">
                  <SettingsPanel key={`${c.name}-${c.listed}-${c.requireDomain}`} view={c} onSaved={load} />
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Circle;
