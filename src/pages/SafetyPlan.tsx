import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardList, DoorOpen, Eye, Home, Phone, Plus, Printer, Trash2, Users } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import type { MessageKey } from "@/i18n/en";
import { deletePlan, emptyPlan, ESSENTIALS, readPlan, savePlan, type SafetyPlan as Plan } from "@/lib/safetyPlan";

const HELPLINES: Array<{ number: string; label: MessageKey }> = [
  { number: "112", label: "plan.call112" },
  { number: "181", label: "plan.call181" },
  { number: "7827170170", label: "plan.callNcw" },
  { number: "15100", label: "plan.callLegal" },
];

const Section = ({ icon: Icon, title, hint, children }: { icon: typeof Eye; title: string; hint: string; children: React.ReactNode }) => (
  <section className="space-y-3 rounded-3xl bg-card p-5 shadow-card ring-1 ring-border sm:p-6 print:break-inside-avoid print:shadow-none">
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
    </div>
    {children}
  </section>
);

// A personal safety plan for someone at risk at home. Kept only on this phone and saved as it's
// typed; the quick exit (Esc twice, or the Exit button) leaves the page at once.
const SafetyPlan = () => {
  const { t } = useI18n();
  const { toast } = useToast();
  const [plan, setPlan] = useState<Plan>(readPlan);
  const [savedAt, setSavedAt] = useState<string | undefined>(plan.updatedAt);
  const first = useRef(true);

  // Save on every change: it's a small local write, and nothing typed is lost if she has to
  // leave the page in a hurry.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setSavedAt(savePlan(plan).updatedAt);
  }, [plan]);

  const update = (patch: Partial<Plan>) => setPlan((p) => ({ ...p, ...patch }));
  const setPerson = (i: number, patch: Partial<Plan["people"][number]>) =>
    update({ people: plan.people.map((p, j) => (j === i ? { ...p, ...patch } : p)) });

  const remove = () => {
    deletePlan();
    first.current = true;
    setPlan(emptyPlan());
    setSavedAt(undefined);
    toast({ title: t("plan.deleted") });
  };

  return (
    <div className="min-h-screen">
      <div className="print:hidden">
        <Navbar />
      </div>
      <main className="px-4 pb-24 pt-28 md:pt-36 print:p-0">
        <div className="container mx-auto max-w-3xl space-y-6">
          <header className="space-y-3">
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-primary print:hidden">{t("plan.kicker")}</p>
            <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">{t("plan.title")}</h1>
            <p className="text-lg text-muted-foreground print:hidden">{t("plan.intro")}</p>
            <p className="rounded-2xl bg-primary/5 p-4 text-sm ring-1 ring-primary/20 print:hidden">{t("plan.privacy")}</p>
          </header>

          <Section icon={Eye} title={t("plan.signsTitle")} hint={t("plan.signsHint")}>
            <label htmlFor="plan-signs" className="sr-only">
              {t("plan.signsTitle")}
            </label>
            <Textarea
              id="plan-signs"
              rows={3}
              maxLength={2000}
              value={plan.signs}
              onChange={(e) => update({ signs: e.target.value })}
              placeholder={t("plan.signsPlaceholder")}
            />
          </Section>

          <Section icon={Users} title={t("plan.peopleTitle")} hint={t("plan.peopleHint")}>
            {plan.people.map((p, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <Input
                  aria-label={t("plan.personName")}
                  value={p.name}
                  maxLength={60}
                  onChange={(e) => setPerson(i, { name: e.target.value })}
                  placeholder={t("plan.personName")}
                  className="min-w-[8rem] flex-1"
                />
                <Input
                  aria-label={t("plan.personPhone")}
                  type="tel"
                  value={p.phone}
                  maxLength={20}
                  onChange={(e) => setPerson(i, { phone: e.target.value })}
                  placeholder="+91 98765 43210"
                  className="min-w-[8rem] flex-1"
                />
                {p.phone.trim() && (
                  <a
                    href={`tel:${p.phone.replace(/\s/g, "")}`}
                    className="rounded-full p-2 text-primary hover:bg-muted print:hidden"
                    aria-label={t("plan.callPerson", { name: p.name || p.phone })}
                  >
                    <Phone className="h-4 w-4" />
                  </a>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="print:hidden"
                  onClick={() => update({ people: plan.people.filter((_, j) => j !== i) })}
                  aria-label={t("plan.removePerson", { name: p.name || "" })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {plan.people.length < 10 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 print:hidden"
                onClick={() => update({ people: [...plan.people, { name: "", phone: "" }] })}
              >
                <Plus className="h-4 w-4" /> {t("plan.addPerson")}
              </Button>
            )}
            <p className="text-sm text-muted-foreground print:hidden">
              {t("plan.codePhrase")}{" "}
              <Link to="/account#safety-at-home" className="font-semibold text-primary underline underline-offset-2">
                {t("plan.codePhraseLink")}
              </Link>
            </p>
          </Section>

          <Section icon={Home} title={t("plan.placesTitle")} hint={t("plan.placesHint")}>
            <label htmlFor="plan-places" className="sr-only">
              {t("plan.placesTitle")}
            </label>
            <Textarea
              id="plan-places"
              rows={3}
              maxLength={2000}
              value={plan.places}
              onChange={(e) => update({ places: e.target.value })}
              placeholder={t("plan.placesPlaceholder")}
            />
          </Section>

          <Section icon={DoorOpen} title={t("plan.leavingTitle")} hint={t("plan.leavingHint")}>
            <label htmlFor="plan-leaving" className="sr-only">
              {t("plan.leavingTitle")}
            </label>
            <Textarea
              id="plan-leaving"
              rows={3}
              maxLength={2000}
              value={plan.leaving}
              onChange={(e) => update({ leaving: e.target.value })}
              placeholder={t("plan.leavingPlaceholder")}
            />
          </Section>

          <Section icon={ClipboardList} title={t("plan.packTitle")} hint={t("plan.packHint")}>
            <ul className="grid gap-2 sm:grid-cols-2">
              {ESSENTIALS.map((e) => (
                <li key={e}>
                  <label className="flex items-start gap-2 text-sm">
                    <Checkbox
                      checked={plan.packed.includes(e)}
                      onCheckedChange={(v) => update({ packed: v === true ? [...plan.packed, e] : plan.packed.filter((x) => x !== e) })}
                      className="mt-0.5"
                    />
                    {t(`plan.item.${e}` as MessageKey)}
                  </label>
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground print:hidden">
              {t("plan.evidenceHint")}{" "}
              <Link to="/account" className="font-semibold text-primary underline underline-offset-2">
                {t("plan.evidenceLink")}
              </Link>
            </p>
          </Section>

          <Section icon={Phone} title={t("plan.helpTitle")} hint={t("plan.helpHint")}>
            <ul className="grid gap-2 sm:grid-cols-2">
              {HELPLINES.map((h) => (
                <li key={h.number}>
                  <a href={`tel:${h.number}`} className="flex items-center gap-2 rounded-2xl bg-muted/60 px-4 py-3 text-sm hover:bg-muted">
                    <span className="font-bold tabular-nums">{h.number}</span>
                    <span className="text-muted-foreground">{t(h.label)}</span>
                  </a>
                </li>
              ))}
            </ul>
            <Link to="/help#domestic-violence" className="inline-block text-sm font-semibold text-primary underline underline-offset-2 print:hidden">
              {t("plan.rights")}
            </Link>
          </Section>

          <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
            <p className="text-sm text-muted-foreground" role="status">
              {savedAt
                ? t("plan.saved", { time: new Date(savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) })
                : t("plan.notSaved")}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="gap-2" onClick={() => window.print()}>
                <Printer className="h-4 w-4" /> {t("plan.print")}
              </Button>
              <Button type="button" variant="ghost" className="gap-2 text-destructive" onClick={remove}>
                <Trash2 className="h-4 w-4" /> {t("plan.delete")}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground print:hidden">{t("plan.printWarning")}</p>
        </div>
      </main>
      <div className="print:hidden">
        <Footer />
      </div>
    </div>
  );
};

export default SafetyPlan;
