import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BadgeCheck, ChevronRight, EyeOff, KeyRound, Lock, Plus, Search, ShieldCheck, Users } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/i18n";
import type { MessageKey } from "@/i18n/en";
import { api } from "@/lib/api";
import { CIRCLE_KINDS, kindKey, roleKey, type CircleKind, type ListedCircle, type MyCircle } from "@/components/circles/types";

const POINTS: Array<{ icon: typeof Lock; title: MessageKey; text: MessageKey }> = [
  { icon: Lock, title: "circles.point1Title", text: "circles.point1Text" },
  { icon: EyeOff, title: "circles.point2Title", text: "circles.point2Text" },
  { icon: ShieldCheck, title: "circles.point3Title", text: "circles.point3Text" },
  { icon: BadgeCheck, title: "circles.point4Title", text: "circles.point4Text" },
];

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const CreateCircle = ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<CircleKind>("college");
  const [domain, setDomain] = useState("");
  const [requireDomain, setRequireDomain] = useState(false);
  const [listed, setListed] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await api<{ id: number; joinCode: string }>("/api/circles", {
        body: { name, description, kind, emailDomain: domain.trim(), requireDomain: requireDomain && Boolean(domain.trim()), listed },
      });
      navigate(`/circles/${res.id}`, { state: { joinCode: res.joinCode } });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("circles.createTitle")}</DialogTitle>
          <DialogDescription>{t("circles.createText")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="circle-name">{t("circles.name")}</Label>
            <Input
              id="circle-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              placeholder={t("circles.namePlaceholder")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="circle-description">{t("circles.description")}</Label>
            <Textarea id="circle-description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="circle-kind">{t("circles.kindLabel")}</Label>
            <select id="circle-kind" value={kind} onChange={(e) => setKind(e.target.value as CircleKind)} className={selectClass}>
              {CIRCLE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(kindKey(k))}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="circle-domain">{t("circles.domain")}</Label>
            <Input id="circle-domain" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="college.edu" maxLength={100} />
            <p className="text-sm text-muted-foreground">{t("circles.domainHint")}</p>
          </div>
          {domain.trim() && (
            <div className="flex items-start justify-between gap-4 rounded-2xl bg-muted/60 p-4">
              <label htmlFor="circle-require" className="text-sm">
                <span className="font-semibold">{t("circles.requireDomain", { domain: domain.trim() })}</span>
                <span className="block text-muted-foreground">{t("circles.requireDomainHint")}</span>
              </label>
              <Switch id="circle-require" checked={requireDomain} onCheckedChange={setRequireDomain} />
            </div>
          )}
          <div className="flex items-start justify-between gap-4 rounded-2xl bg-muted/60 p-4">
            <label htmlFor="circle-listed" className="text-sm">
              <span className="font-semibold">{t("circles.listed")}</span>
              <span className="block text-muted-foreground">{t("circles.listedHint")}</span>
            </label>
            <Switch id="circle-listed" checked={listed} onCheckedChange={setListed} />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" variant="hero" className="w-full" disabled={saving || name.trim().length < 3 || description.trim().length < 10}>
            {saving ? t("circles.creating") : t("circles.create")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const Directory = ({ onRequested }: { onRequested: () => void }) => {
  const { t, tn } = useI18n();
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ListedCircle[] | null>(null);

  const search = useCallback((query: string) => {
    api<{ circles: ListedCircle[] }>(`/api/circles/directory?q=${encodeURIComponent(query)}`)
      .then((r) => setResults(r.circles))
      .catch(() => setResults([]));
  }, []);
  useEffect(() => search(""), [search]);

  const request = async (c: ListedCircle) => {
    try {
      await api(`/api/circles/${c.id}/request`, { method: "POST" });
      toast({ title: t("circles.requested"), description: t("circles.requestedText") });
      search(q);
      onRequested();
    } catch (err) {
      toast({ title: t("circles.requestFailed"), description: (err as Error).message, variant: "destructive" });
    }
  };

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-extrabold">{t("circles.findTitle")}</h2>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          search(q);
        }}
        className="flex gap-2"
      >
        <label htmlFor="circle-search" className="sr-only">
          {t("circles.search")}
        </label>
        <Input id="circle-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("circles.searchPlaceholder")} />
        <Button type="submit" variant="glass" className="gap-2">
          <Search className="h-4 w-4" /> {t("circles.search")}
        </Button>
      </form>
      {results === null ? (
        <div className="h-24 animate-pulse rounded-3xl bg-muted" />
      ) : results.length === 0 ? (
        <p className="rounded-3xl bg-muted/60 p-6 text-center text-muted-foreground">{q ? t("circles.noResults") : t("circles.noListed")}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {results.map((c) => (
            <article key={c.id} className="flex flex-col gap-3 rounded-3xl bg-card p-5 shadow-card ring-1 ring-border">
              <div>
                <h3 className="text-lg font-bold">{c.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {t(kindKey(c.kind))} · {tn("circles.memberCount", c.members)}
                  {c.requireDomain && c.emailDomain && <> · {t("circles.onlyDomain", { domain: c.emailDomain })}</>}
                </p>
              </div>
              <p className="flex-1 text-muted-foreground">{c.description}</p>
              <Button type="button" variant={c.requested ? "ghost" : "glass"} disabled={c.requested} onClick={() => request(c)}>
                {c.requested ? t("circles.requestSent") : t("circles.askToJoin")}
              </Button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};

const Circles = () => {
  const { t, tn } = useI18n();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [mine, setMine] = useState<MyCircle[] | null>(null);
  const [code, setCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    api<{ circles: MyCircle[] }>("/api/circles")
      .then((r) => setMine(r.circles))
      .catch(() => setMine([]));
  }, []);
  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError("");
    try {
      const res = await api<{ id: number }>("/api/circles/join", { body: { code } });
      navigate(`/circles/${res.id}`);
    } catch (err) {
      setJoinError((err as Error).message);
    }
  };

  const withdraw = async (id: number) => {
    await api(`/api/circles/${id}/leave`, { method: "POST" }).catch(() => {});
    load();
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="px-4 pb-24 pt-28 md:pt-36">
        <div className="container mx-auto max-w-6xl space-y-12">
          <header className="mx-auto max-w-3xl space-y-5 text-center">
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-primary">{t("circles.kicker")}</p>
            <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">{t("circles.title")}</h1>
            <p className="text-lg leading-relaxed text-muted-foreground md:text-xl">{t("circles.intro")}</p>
          </header>

          {!loading && !user ? (
            <div className="space-y-10">
              <div className="grid gap-5 sm:grid-cols-2">
                {POINTS.map(({ icon: Icon, title, text }) => (
                  <div key={title} className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border">
                    <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-brand text-white shadow-raised">
                      <Icon className="h-6 w-6" />
                    </span>
                    <h2 className="mb-1 text-lg font-bold">{t(title)}</h2>
                    <p className="text-muted-foreground">{t(text)}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-col items-center gap-3 text-center">
                <p className="text-muted-foreground">{t("circles.loginText")}</p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Link to="/login?next=/circles">
                    <Button variant="hero" size="lg" className="w-full sm:w-auto">
                      {t("common.logIn")}
                    </Button>
                  </Link>
                  <Link to="/signup?next=/circles">
                    <Button variant="glass" size="lg" className="w-full sm:w-auto">
                      {t("common.signUp")}
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <>
              <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-2xl font-extrabold">{t("circles.yours")}</h2>
                  <Button type="button" variant="hero" className="gap-2" onClick={() => setCreating(true)}>
                    <Plus className="h-4 w-4" /> {t("circles.startOne")}
                  </Button>
                </div>
                {mine === null ? (
                  <div className="h-24 animate-pulse rounded-3xl bg-muted" />
                ) : mine.length === 0 ? (
                  <p className="rounded-3xl bg-muted/60 p-6 text-center text-muted-foreground">{t("circles.none")}</p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {mine.map((c) =>
                      c.status === "pending" ? (
                        <article key={c.id} className="flex items-center gap-4 rounded-3xl bg-card p-5 shadow-card ring-1 ring-border">
                          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                            <Users className="h-6 w-6" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate font-bold">{c.name}</h3>
                            <p className="text-sm text-muted-foreground">{t("circles.waiting")}</p>
                          </div>
                          <Button type="button" variant="ghost" size="sm" onClick={() => withdraw(c.id)}>
                            {t("circles.withdraw")}
                          </Button>
                        </article>
                      ) : (
                        <Link
                          key={c.id}
                          to={`/circles/${c.id}`}
                          className="group flex items-center gap-4 rounded-3xl bg-card p-5 shadow-card ring-1 ring-border transition-all hover:ring-primary/40"
                        >
                          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-brand text-white shadow-raised">
                            <Users className="h-6 w-6" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate font-bold">{c.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {t(kindKey(c.kind))} · {tn("circles.memberCount", c.members)}
                              {c.role !== "member" && <> · {t(roleKey(c.role))}</>}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-2 text-xs font-semibold">
                              {c.newPosts > 0 && (
                                <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-foreground">{tn("circles.newPosts", c.newPosts)}</span>
                              )}
                              {c.toReview > 0 && (
                                <span className="rounded-full bg-brand/15 px-2.5 py-0.5 text-foreground">{tn("circles.toReview", c.toReview)}</span>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
                        </Link>
                      ),
                    )}
                  </div>
                )}
              </section>

              <form
                onSubmit={join}
                className="flex flex-col gap-4 rounded-[2rem] bg-card p-6 shadow-card ring-1 ring-border sm:flex-row sm:items-end sm:p-8"
              >
                <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary sm:flex">
                  <KeyRound className="h-6 w-6" />
                </span>
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="circle-code" className="text-lg font-bold">
                    {t("circles.haveCode")}
                  </Label>
                  <Input
                    id="circle-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="ABCD EFGH"
                    autoComplete="off"
                    maxLength={20}
                    className="font-mono text-lg tracking-widest"
                  />
                  {joinError && (
                    <p role="alert" className="text-sm text-destructive">
                      {joinError}
                    </p>
                  )}
                </div>
                <Button type="submit" variant="hero" size="lg" disabled={code.replace(/\s/g, "").length < 6}>
                  {t("circles.join")}
                </Button>
              </form>

              {user && <Directory onRequested={load} />}
              <CreateCircle open={creating} onOpenChange={setCreating} />
            </>
          )}
          <p className="mx-auto max-w-2xl text-center text-sm text-muted-foreground">
            {t("circles.emergency")}{" "}
            <Link to="/sos" className="font-semibold text-destructive underline underline-offset-2">
              {t("common.emergencySos")}
            </Link>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Circles;
