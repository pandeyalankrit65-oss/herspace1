import { useState } from "react";
import { Link } from "react-router-dom";
import { Droplets, PenLine, Sun, Users } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useI18n } from "@/i18n";
import type { MessageKey } from "@/i18n/en";
import Breathing from "@/components/wellbeing/Breathing";
import Grounding from "@/components/wellbeing/Grounding";
import MoodCheckin, { SupportCard } from "@/components/wellbeing/MoodCheckin";
import { needsSupport, readJournal, type MoodEntry } from "@/lib/mood";

const TIPS: Array<{ icon: typeof Sun; title: MessageKey; text: MessageKey; link?: { to: string; label: MessageKey } }> = [
  { icon: Droplets, title: "wb.tip1Title", text: "wb.tip1Text" },
  { icon: Users, title: "wb.tip2Title", text: "wb.tip2Text" },
  { icon: Sun, title: "wb.tip3Title", text: "wb.tip3Text" },
  { icon: PenLine, title: "wb.tip4Title", text: "wb.tip4Text", link: { to: "/report", label: "wb.tip4Link" } },
];

// Calm-down exercises and a private mood journal. Nothing here is sent anywhere.
const Wellbeing = () => {
  const { t } = useI18n();
  const [entries, setEntries] = useState<MoodEntry[]>(() => readJournal());
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="px-4 pb-24 pt-28 md:pt-36">
        <div className="container mx-auto max-w-5xl space-y-10">
          <header className="mx-auto max-w-3xl space-y-5 text-center">
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-primary">{t("wb.kicker")}</p>
            <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">{t("wb.title")}</h1>
            <p className="text-lg leading-relaxed text-muted-foreground md:text-xl">{t("wb.intro")}</p>
          </header>

          <div className="grid gap-6 lg:grid-cols-2">
            <Breathing />
            <Grounding />
          </div>

          <MoodCheckin entries={entries} setEntries={setEntries} />

          <section aria-labelledby="tips-title" className="space-y-4">
            <h2 id="tips-title" className="text-2xl font-extrabold">
              {t("wb.tipsTitle")}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {TIPS.map(({ icon: Icon, title, text, link }) => (
                <div key={title} className="flex gap-4 rounded-3xl bg-card p-5 shadow-card ring-1 ring-border">
                  <Icon className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
                  <div>
                    <h3 className="font-bold">{t(title)}</h3>
                    <p className="text-sm text-muted-foreground">
                      {t(text)}{" "}
                      {link && (
                        <Link to={link.to} className="font-semibold text-primary underline underline-offset-2">
                          {t(link.label)}
                        </Link>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Shown inside the check-in instead when the journal suggests a hard time. */}
          {!needsSupport(entries) && <SupportCard />}

          <p className="mx-auto max-w-2xl text-center text-sm text-muted-foreground">
            {t("wb.disclaimer")}{" "}
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

export default Wellbeing;
