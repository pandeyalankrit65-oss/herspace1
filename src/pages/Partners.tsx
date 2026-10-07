import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, ExternalLink, Globe, MapPin, Phone, Send } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { HELPLINES } from "@/content/help";
import {
  KIND_ICON,
  LANGUAGE_NAMES,
  PARTNER_KINDS,
  PARTNER_LANGUAGES,
  feesKey,
  kindKey,
  type Partner,
  type PartnerKind,
  type PartnerLanguage,
} from "@/components/partners/types";

// Official services to call while the directory is empty (or has no match).
const FALLBACK_NUMBERS = ["181", "14416", "15100", "7827170170", "112"];

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const RequestDialog = ({ partner, onClose }: { partner: Partner | null; onClose: () => void }) => {
  const { t } = useI18n();
  const { toast } = useToast();
  const { user } = useAuth();
  const [method, setMethod] = useState<"email" | "phone">("phone");
  const [value, setValue] = useState("");
  const [time, setTime] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!partner) return;
    setMethod(user?.phone ? "phone" : "email");
    setValue(user?.phone ?? user?.email ?? "");
    setTime("");
    setMessage("");
    setConsent(false);
    setError("");
  }, [partner, user]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partner) return;
    setError("");
    setSending(true);
    try {
      await api(`/api/partners/${partner.id}/request`, {
        body: { contactMethod: method, contactValue: value, preferredTime: time, message, consent },
      });
      toast({ title: t("partners.requestSent"), description: t("partners.requestSentText", { name: partner.name }) });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={Boolean(partner)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("partners.requestTitle", { name: partner?.name ?? "" })}</DialogTitle>
          <DialogDescription>{t("partners.requestText")}</DialogDescription>
        </DialogHeader>
        {!user ? (
          <div className="space-y-3">
            <p className="text-muted-foreground">{t("partners.loginToRequest")}</p>
            <Link to="/login?next=/partners">
              <Button variant="hero" className="w-full">
                {t("common.logIn")}
              </Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={send} className="space-y-4">
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold">{t("partners.reachMe")}</legend>
              <div className="inline-flex rounded-full bg-muted p-1">
                {(["phone", "email"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={method === m}
                    onClick={() => {
                      setMethod(m);
                      setValue(m === "phone" ? (user.phone ?? "") : user.email);
                    }}
                    className={cn("rounded-full px-4 py-1.5 text-sm font-semibold", method === m ? "bg-card shadow-sm" : "text-muted-foreground")}
                  >
                    {m === "phone" ? t("partners.byPhone") : t("partners.byEmail")}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="space-y-1.5">
              <Label htmlFor="request-contact">{method === "phone" ? t("partners.phoneLabel") : t("partners.emailLabel")}</Label>
              <Input
                id="request-contact"
                type={method === "phone" ? "tel" : "email"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={method === "phone" ? "+91 98765 43210" : "you@example.com"}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="request-time">{t("partners.preferredTime")}</Label>
              <Input
                id="request-time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                maxLength={200}
                placeholder={t("partners.preferredTimeHint")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="request-message">{t("partners.message")}</Label>
              <Textarea id="request-message" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} />
              <p className="text-sm text-muted-foreground">{t("partners.messageHint")}</p>
            </div>
            <div className="flex items-start gap-3 rounded-2xl bg-muted/60 p-4">
              <Checkbox id="request-consent" checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
              <label htmlFor="request-consent" className="text-sm">
                {t("partners.consent", { name: partner?.name ?? "" })}
              </label>
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" variant="hero" className="w-full gap-2" disabled={sending || !consent || !value.trim()}>
              <Send className="h-4 w-4" /> {sending ? t("partners.sending") : t("partners.send")}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

const Helplines = () => {
  const { t, lang } = useI18n();
  return (
    <section className="space-y-4 rounded-[2rem] bg-card p-6 shadow-card ring-1 ring-border sm:p-8">
      <div>
        <h2 className="text-xl font-extrabold">{t("partners.helplinesTitle")}</h2>
        <p className="mt-1 text-muted-foreground">{t("partners.helplinesText")}</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {FALLBACK_NUMBERS.map((n) => HELPLINES.find((h) => h.number === n))
          .filter((h) => h !== undefined)
          .map((h) => (
            <li key={h.number}>
              <a href={`tel:${h.number}`} className="flex items-center gap-3 rounded-2xl bg-muted/60 p-4 transition-colors hover:bg-muted">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Phone className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block font-bold tabular-nums">{h.number}</span>
                  <span className="block text-sm text-muted-foreground">{h.label[lang]}</span>
                </span>
              </a>
            </li>
          ))}
      </ul>
      <Link to="/help" className="inline-block text-sm font-semibold text-primary underline underline-offset-2">
        {t("partners.moreHelp")}
      </Link>
    </section>
  );
};

const Partners = () => {
  const { t } = useI18n();
  const [kind, setKind] = useState<PartnerKind | "">("");
  const [city, setCity] = useState("");
  const [language, setLanguage] = useState<PartnerLanguage | "">("");
  const [partners, setPartners] = useState<Partner[] | null>(null);
  const [cities, setCities] = useState<string[]>([]);
  const [requesting, setRequesting] = useState<Partner | null>(null);

  const load = useCallback(() => {
    const q = new URLSearchParams();
    if (kind) q.set("kind", kind);
    if (city) q.set("city", city);
    if (language) q.set("lang", language);
    api<{ partners: Partner[]; cities: string[] }>(`/api/partners?${q}`)
      .then((r) => {
        setPartners(r.partners);
        setCities(r.cities);
      })
      .catch(() => setPartners([]));
  }, [kind, city, language]);
  useEffect(load, [load]);

  const languageName = (l: PartnerLanguage) => (l === "other" ? t("partners.langOther") : LANGUAGE_NAMES[l]);
  const filtered = Boolean(kind || city || language);

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="px-4 pb-24 pt-28 md:pt-36">
        <div className="container mx-auto max-w-6xl space-y-10">
          <header className="mx-auto max-w-3xl space-y-5 text-center">
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-primary">{t("partners.kicker")}</p>
            <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">{t("partners.title")}</h1>
            <p className="text-lg leading-relaxed text-muted-foreground md:text-xl">{t("partners.intro")}</p>
          </header>

          <div className="space-y-4">
            <div className="flex flex-wrap gap-2" role="group" aria-label={t("partners.kindFilter")}>
              {(["", ...PARTNER_KINDS] as const).map((k) => {
                const Icon = k ? KIND_ICON[k] : null;
                return (
                  <button
                    key={k || "all"}
                    type="button"
                    aria-pressed={kind === k}
                    onClick={() => setKind(k)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold ring-1 transition-colors",
                      kind === k
                        ? "bg-primary text-primary-foreground ring-primary"
                        : "bg-card text-muted-foreground ring-border hover:text-foreground",
                    )}
                  >
                    {Icon && <Icon className="h-4 w-4" />} {k ? t(kindKey(k)) : t("partners.all")}
                  </button>
                );
              })}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:max-w-xl">
              <div className="space-y-1.5">
                <Label htmlFor="partner-city">{t("partners.city")}</Label>
                <select id="partner-city" value={city} onChange={(e) => setCity(e.target.value)} className={selectClass}>
                  <option value="">{t("partners.anyCity")}</option>
                  {cities.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="partner-lang">{t("partners.language")}</Label>
                <select
                  id="partner-lang"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as PartnerLanguage | "")}
                  className={selectClass}
                >
                  <option value="">{t("partners.anyLanguage")}</option>
                  {PARTNER_LANGUAGES.filter((l) => l !== "other").map((l) => (
                    <option key={l} value={l}>
                      {languageName(l)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {partners === null ? (
            <div className="h-40 animate-pulse rounded-3xl bg-muted" />
          ) : partners.length === 0 ? (
            <div className="space-y-6">
              <p className="rounded-3xl bg-muted/60 p-6 text-center text-muted-foreground">
                {filtered ? t("partners.noMatch") : t("partners.empty")}
              </p>
              <Helplines />
            </div>
          ) : (
            <>
              <div className="grid gap-5 md:grid-cols-2">
                {partners.map((p) => {
                  const Icon = KIND_ICON[p.kind];
                  return (
                    <article key={p.id} className="flex flex-col gap-4 rounded-3xl bg-card p-6 shadow-card ring-1 ring-border">
                      <header className="flex items-start gap-4">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-brand text-white shadow-raised">
                          <Icon className="h-6 w-6" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <h2 className="text-lg font-bold">{p.name}</h2>
                          <p className="text-sm text-muted-foreground">{t(kindKey(p.kind))}</p>
                        </div>
                      </header>
                      <p className="text-muted-foreground">{p.description}</p>
                      <ul className="flex flex-wrap gap-2 text-sm">
                        <li className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1">
                          <MapPin className="h-3.5 w-3.5" /> {p.inPerson ? p.city : t("partners.onlineOnly")}
                        </li>
                        {p.online && p.inPerson && (
                          <li className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1">
                            <Globe className="h-3.5 w-3.5" /> {t("partners.online")}
                          </li>
                        )}
                        <li className="rounded-full bg-muted px-3 py-1">{p.languages.map(languageName).join(", ")}</li>
                        <li className="rounded-full bg-muted px-3 py-1">
                          {t(feesKey(p.fees))}
                          {p.feeNote && <> · {p.feeNote}</>}
                        </li>
                      </ul>
                      {p.verifiedAt && (
                        <p className="inline-flex items-center gap-1.5 text-sm font-semibold">
                          <BadgeCheck className="h-4 w-4 text-success" />
                          {t("partners.checkedOn", { date: new Date(p.verifiedAt).toLocaleDateString([], { dateStyle: "medium" }) })}
                        </p>
                      )}
                      <div className="mt-auto flex flex-wrap gap-2">
                        <Button type="button" variant="hero" className="gap-2" onClick={() => setRequesting(p)}>
                          <Send className="h-4 w-4" /> {t("partners.request")}
                        </Button>
                        {p.website && (
                          <a href={p.website} target="_blank" rel="noopener noreferrer nofollow">
                            <Button type="button" variant="glass" className="gap-2" tabIndex={-1}>
                              <ExternalLink className="h-4 w-4" /> {t("partners.website")}
                            </Button>
                          </a>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
              <p className="text-sm text-muted-foreground">{t("partners.disclaimer")}</p>
            </>
          )}

          <section className="flex flex-col items-start gap-3 rounded-[2rem] bg-primary/5 p-6 ring-1 ring-primary/20 sm:flex-row sm:items-center sm:p-8">
            <div className="flex-1">
              <h2 className="text-xl font-extrabold">{t("partners.joinTitle")}</h2>
              <p className="mt-1 text-muted-foreground">{t("partners.joinText")}</p>
            </div>
            <Link to="/partners/join">
              <Button variant="glass" size="lg">
                {t("partners.joinButton")}
              </Button>
            </Link>
          </section>
          <p className="mx-auto max-w-2xl text-center text-sm text-muted-foreground">
            {t("partners.emergency")}{" "}
            <Link to="/sos" className="font-semibold text-destructive underline underline-offset-2">
              {t("common.emergencySos")}
            </Link>
          </p>
        </div>
      </main>
      <Footer />
      <RequestDialog partner={requesting} onClose={() => setRequesting(null)} />
    </div>
  );
};

export default Partners;
