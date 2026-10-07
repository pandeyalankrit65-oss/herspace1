import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Clock, EyeOff, BadgeCheck, XCircle } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  FEES,
  LANGUAGE_NAMES,
  PARTNER_KINDS,
  PARTNER_LANGUAGES,
  feesKey,
  kindKey,
  statusKey,
  type Fees,
  type PartnerFull,
  type PartnerKind,
  type PartnerLanguage,
} from "@/components/partners/types";

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const STATUS_ICON = { pending: Clock, approved: BadgeCheck, rejected: XCircle, hidden: EyeOff } as const;

// For counsellors, lawyers, NGOs, trainers and doctors: apply to be listed, or edit a listing.
const PartnerJoin = () => {
  const { t, tn } = useI18n();
  const { toast } = useToast();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [listing, setListing] = useState<PartnerFull | null | undefined>(undefined);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<PartnerKind>("counsellor");
  const [city, setCity] = useState("");
  const [languages, setLanguages] = useState<PartnerLanguage[]>(["en"]);
  const [description, setDescription] = useState("");
  const [credentials, setCredentials] = useState("");
  const [fees, setFees] = useState<Fees>("free");
  const [feeNote, setFeeNote] = useState("");
  const [online, setOnline] = useState(true);
  const [inPerson, setInPerson] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const fill = (p: PartnerFull | null) => {
    setListing(p);
    if (!p) return;
    setName(p.name);
    setKind(p.kind);
    setCity(p.city);
    setLanguages(p.languages);
    setDescription(p.description);
    setCredentials(p.credentials);
    setFees(p.fees);
    setFeeNote(p.feeNote ?? "");
    setOnline(p.online);
    setInPerson(p.inPerson);
    setEmail(p.email);
    setPhone(p.phone ?? "");
    setWebsite(p.website ?? "");
  };

  useEffect(() => {
    if (!loading && !user) navigate("/login?next=/partners/join", { replace: true });
    if (!user) return;
    setEmail((e) => e || user.email);
    api<{ partner: PartnerFull | null }>("/api/partners/mine")
      .then((r) => fill(r.partner))
      .catch(() => setListing(null));
  }, [user, loading, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await api<{ partner: PartnerFull }>("/api/partners/mine", {
        method: "PUT",
        body: { name, kind, city, languages, description, credentials, fees, feeNote, online, inPerson, email, phone, website },
      });
      fill(res.partner);
      toast({ title: t("partners.submitted"), description: t("partners.submittedText") });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    await api("/api/partners/mine", { method: "DELETE" }).catch(() => {});
    toast({ title: t("partners.removed") });
    navigate("/partners");
  };

  const toggleLanguage = (l: PartnerLanguage, on: boolean) => setLanguages((prev) => (on ? [...prev, l] : prev.filter((x) => x !== l)));
  const StatusIcon = listing ? STATUS_ICON[listing.status] : null;

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="px-4 pb-24 pt-28 md:pt-36">
        <div className="container mx-auto max-w-2xl space-y-8">
          <Link to="/partners" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> {t("partners.back")}
          </Link>
          <header className="space-y-3">
            <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">{t("partners.joinTitle")}</h1>
            <p className="text-lg text-muted-foreground">{t("partners.applyIntro")}</p>
          </header>

          {listing && StatusIcon && (
            <section
              className={cn(
                "space-y-2 rounded-3xl p-5 ring-1",
                listing.status === "approved"
                  ? "bg-success/10 ring-success/30"
                  : listing.status === "pending"
                    ? "bg-primary/5 ring-primary/20"
                    : "bg-destructive/5 ring-destructive/25",
              )}
            >
              <p className="flex items-center gap-2 font-bold">
                <StatusIcon className="h-5 w-5" /> {t(statusKey(listing.status))}
              </p>
              <p className="text-sm text-muted-foreground">{t(`partners.statusText.${listing.status}` as "partners.statusText.pending")}</p>
              {listing.reviewNote && (
                <p className="text-sm">
                  <span className="font-semibold">{t("partners.reviewNote")}</span> {listing.reviewNote}
                </p>
              )}
              {listing.status === "approved" && <p className="text-sm">{tn("partners.requestsCount", listing.requests ?? 0)}</p>}
            </section>
          )}

          {listing === undefined ? (
            <div className="h-96 animate-pulse rounded-3xl bg-muted" />
          ) : (
            <form onSubmit={submit} className="space-y-5 rounded-[2rem] bg-card p-6 shadow-card ring-1 ring-border sm:p-8">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="p-name">{t("partners.f.name")}</Label>
                  <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-kind">{t("partners.f.kind")}</Label>
                  <select id="p-kind" value={kind} onChange={(e) => setKind(e.target.value as PartnerKind)} className={selectClass}>
                    {PARTNER_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {t(kindKey(k))}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-city">{t("partners.f.city")}</Label>
                  <Input id="p-city" value={city} onChange={(e) => setCity(e.target.value)} maxLength={60} placeholder="Pune" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-description">{t("partners.f.description")}</Label>
                <Textarea id="p-description" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} />
                <p className="text-sm text-muted-foreground">{t("partners.f.descriptionHint")}</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-credentials">{t("partners.f.credentials")}</Label>
                <Textarea id="p-credentials" rows={2} value={credentials} onChange={(e) => setCredentials(e.target.value)} maxLength={500} />
                <p className="text-sm text-muted-foreground">{t("partners.f.credentialsHint")}</p>
              </div>
              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold">{t("partners.f.languages")}</legend>
                <div className="flex flex-wrap gap-4">
                  {PARTNER_LANGUAGES.map((l) => (
                    <label key={l} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={languages.includes(l)} onCheckedChange={(v) => toggleLanguage(l, v === true)} />
                      {l === "other" ? t("partners.langOther") : LANGUAGE_NAMES[l]}
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold">{t("partners.f.how")}</legend>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={online} onCheckedChange={(v) => setOnline(v === true)} /> {t("partners.online")}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={inPerson} onCheckedChange={(v) => setInPerson(v === true)} /> {t("partners.inPerson")}
                  </label>
                </div>
              </fieldset>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="p-fees">{t("partners.f.fees")}</Label>
                  <select id="p-fees" value={fees} onChange={(e) => setFees(e.target.value as Fees)} className={selectClass}>
                    {FEES.map((f) => (
                      <option key={f} value={f}>
                        {t(feesKey(f))}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-fee-note">{t("partners.f.feeNote")}</Label>
                  <Input
                    id="p-fee-note"
                    value={feeNote}
                    onChange={(e) => setFeeNote(e.target.value)}
                    maxLength={200}
                    placeholder={t("partners.f.feeNoteHint")}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="p-email">{t("partners.f.email")}</Label>
                  <Input id="p-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-phone">{t("partners.f.phone")}</Label>
                  <Input id="p-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{t("partners.f.contactHint")}</p>
              <div className="space-y-1.5">
                <Label htmlFor="p-website">{t("partners.f.website")}</Label>
                <Input
                  id="p-website"
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://"
                  maxLength={200}
                />
              </div>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <div className="flex flex-wrap gap-3">
                <Button type="submit" variant="hero" size="lg" disabled={saving || languages.length === 0}>
                  {listing ? t("partners.resubmit") : t("partners.apply")}
                </Button>
                {listing && (
                  <Button type="button" variant="ghost" size="lg" className="text-destructive" onClick={remove}>
                    {t("partners.removeListing")}
                  </Button>
                )}
              </div>
              {listing && <p className="text-sm text-muted-foreground">{t("partners.editNote")}</p>}
            </form>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PartnerJoin;
