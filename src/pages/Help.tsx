import { Link } from "react-router-dom";
import { ClipboardList, ExternalLink, FileSignature, LifeBuoy, Phone } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PageHeader from "@/components/PageHeader";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/i18n";
import { HELP_SECTIONS, HELPLINES, REVIEWED } from "@/content/help";

// Help & your rights: helplines, what to do after an incident, and the law in plain words.
const Help = () => {
  const { t, lang } = useI18n();
  const sections = HELP_SECTIONS[lang];
  const hash = typeof window !== "undefined" ? window.location.hash.slice(1) : "";

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="px-4 pb-16 pt-24">
        <div className="container mx-auto max-w-3xl space-y-6">
          <PageHeader icon={LifeBuoy} title={t("help.title")} subtitle={t("help.intro")} />

          <section aria-labelledby="helplines">
            <h2 id="helplines" className="mb-3 text-lg font-bold">
              {t("help.helplines")}
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {HELPLINES.map((h) => (
                <li key={h.number}>
                  <a
                    href={`tel:${h.number}`}
                    className="flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-card transition-colors hover:border-primary/40"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Phone className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-lg font-extrabold tabular-nums">{h.number}</span>
                      <span className="block text-sm text-muted-foreground">{h.label[lang]}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>

          <Accordion type="single" collapsible defaultValue={sections.some((s) => s.id === hash) ? hash : undefined} className="space-y-2">
            {sections.map((s) => (
              <AccordionItem key={s.id} value={s.id} id={s.id} className="scroll-mt-24 rounded-2xl border bg-card px-4 shadow-card">
                <AccordionTrigger className="text-left text-base font-bold hover:no-underline">{s.title}</AccordionTrigger>
                <AccordionContent className="space-y-3 text-base">
                  {s.intro && <p className="text-muted-foreground">{s.intro}</p>}
                  <ul className="list-disc space-y-2 pl-5">
                    {s.points.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                  {s.id === "domestic-violence" && (
                    <Link to="/safety-plan" className="inline-flex items-center gap-2 font-semibold text-primary underline underline-offset-2">
                      <ClipboardList className="h-4 w-4" /> {t("plan.linkTitle")}
                    </Link>
                  )}
                  {s.links && (
                    <p className="flex flex-wrap gap-3">
                      {s.links.map((link) => (
                        <a key={link.href} href={link.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-primary underline underline-offset-2">
                          {link.label} <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ))}
                    </p>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center">
              <FileSignature className="h-8 w-8 shrink-0 text-primary" />
              <div className="flex-1">
                <p className="font-bold">{t("help.complaintTitle")}</p>
                <p className="text-sm text-muted-foreground">{t("help.complaintDesc")}</p>
              </div>
              <Link to="/complaint" className="font-semibold text-primary underline underline-offset-2">
                {t("help.complaintButton")}
              </Link>
            </CardContent>
          </Card>

          <p className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">{t("help.disclaimer", { date: REVIEWED[lang] })}</p>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Help;
