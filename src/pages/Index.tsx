import { Link } from "react-router-dom";
import { Shield, Users, AlertCircle, MessageCircle, Map, MapPin, Building2, Timer, Phone, CheckCircle2, Footprints, Languages, Send, UserCheck, EyeOff, Trash2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Dashboard from "@/components/home/Dashboard";
import { useAuth } from "@/contexts/AuthContext";
import { useReveal } from "@/hooks/use-reveal";
import heroImage from "@/assets/hero-safety.jpg";
import { useI18n } from "@/i18n";
import type { MessageKey } from "@/i18n/en";

const FEATURES: Array<{ icon: typeof Shield; title: MessageKey; text: MessageKey; link: string }> = [
  { icon: AlertCircle, title: "home.feature.sosTitle", text: "home.feature.sosText", link: "/sos" },
  { icon: Timer, title: "home.feature.timerTitle", text: "home.feature.timerText", link: "/timer" },
  { icon: Footprints, title: "home.feature.walkTitle", text: "home.feature.walkText", link: "/walk" },
  { icon: Shield, title: "home.feature.reportTitle", text: "home.feature.reportText", link: "/report" },
  { icon: MessageCircle, title: "home.feature.supportTitle", text: "home.feature.supportText", link: "/support" },
  { icon: Map, title: "home.feature.mapTitle", text: "home.feature.mapText", link: "/map" },
  { icon: Phone, title: "home.feature.fakeCallTitle", text: "home.feature.fakeCallText", link: "/sos" },
  { icon: Languages, title: "home.feature.langTitle", text: "home.feature.langText", link: "/about" },
];

const STEPS: Array<{ icon: typeof Shield; title: MessageKey; text: MessageKey }> = [
  { icon: Users, title: "home.how1Title", text: "home.how1Text" },
  { icon: Send, title: "home.how2Title", text: "home.how2Text" },
  { icon: AlertCircle, title: "home.how3Title", text: "home.how3Text" },
];

const PROMISES: Array<{ icon: typeof Shield; title: MessageKey; text: MessageKey }> = [
  { icon: UserCheck, title: "home.privacy1Title", text: "home.privacy1Text" },
  { icon: EyeOff, title: "home.privacy2Title", text: "home.privacy2Text" },
  { icon: Trash2, title: "home.privacy3Title", text: "home.privacy3Text" },
];

const highlight = "bg-gradient-to-r from-primary to-brand bg-clip-text text-transparent";

const Index = () => {
  const { user } = useAuth();
  if (user) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <Dashboard />
        <Footer />
      </div>
    );
  }
  return <Landing />;
};

// For visitors: what HerSpace is, how it works, and the privacy promise.
const Landing = () => {
  const { t, tr } = useI18n();
  const revealRef = useReveal<HTMLDivElement>();

  return (
    <div className="min-h-screen" ref={revealRef}>
      <Navbar />

      <main>
      {/* Hero Section */}
      <section className="relative overflow-hidden px-4 pb-16 pt-28 md:pb-24 md:pt-36">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[36rem] bg-[radial-gradient(60%_50%_at_30%_20%,hsl(var(--primary)/0.14),transparent)]" />
        <div className="container relative mx-auto grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
          <div className="space-y-7 text-center lg:text-left">
            <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground shadow-sm">
              <span className="h-2 w-2 rounded-full bg-success" /> {t("home.badge")}
            </span>
            <h1 className="text-4xl font-extrabold leading-[1.08] sm:text-5xl xl:text-6xl">
              <span className="bg-gradient-to-r from-primary to-brand bg-clip-text text-transparent">{t("home.heroTitle1")}</span>
              <br />
              {t("home.heroTitle2")}
            </h1>
            <p className="mx-auto max-w-xl text-lg text-muted-foreground lg:mx-0">{t("home.heroText")}</p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
              <Link to="/sos">
                <Button variant="emergency" size="xl" className="w-full gap-2 sm:w-auto">
                  <AlertCircle className="h-5 w-5" />
                  {t("home.setUpSos")}
                </Button>
              </Link>
              <Link to="/timer">
                <Button variant="glass" size="xl" className="w-full gap-2 sm:w-auto">
                  <Timer className="h-5 w-5" />
                  {t("home.feature.timerTitle")}
                </Button>
              </Link>
            </div>
            <ul className="flex flex-col items-center gap-2 text-sm font-medium text-muted-foreground sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-5 lg:justify-start">
              {(["home.trust1", "home.trust2", "home.trust3"] as MessageKey[]).map((k) => (
                <li key={k} className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-success" /> {t(k)}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
            <img
              src={heroImage}
              alt={t("home.heroImageAlt")}
              className="aspect-[4/3] w-full rounded-3xl object-cover shadow-raised ring-1 ring-border"
            />
            <div className="absolute -bottom-5 left-4 flex items-center gap-3 rounded-2xl border bg-card/95 p-3 pr-5 shadow-card backdrop-blur sm:left-6">
              <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-success/15 text-success">
                <MapPin className="h-5 w-5" />
                <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-card motion-safe:animate-pulse" />
              </span>
              <span className="text-left">
                <span className="block text-sm font-bold">{t("home.cardTitle")}</span>
                <span className="block text-xs text-muted-foreground">{t("home.cardText")}</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-4 py-16 md:py-24">
        <div className="container mx-auto max-w-5xl">
          <div className="reveal mx-auto mb-12 max-w-2xl text-center">
            <p className="mb-2 text-sm font-bold uppercase tracking-wider text-primary">{t("home.howKicker")}</p>
            <h2 className="text-3xl font-extrabold md:text-4xl">{t("home.howTitle")}</h2>
          </div>
          <ol className="grid gap-6 md:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="reveal relative rounded-3xl border bg-card p-6 shadow-card" style={{ "--reveal-delay": `${i * 90}ms` } as React.CSSProperties}>
                <span className="absolute right-5 top-4 text-5xl font-extrabold text-primary/10" aria-hidden>
                  {i + 1}
                </span>
                <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-brand text-white shadow-raised">
                  <Icon className="h-6 w-6" />
                </span>
                <h3 className="mb-1 text-lg font-bold">{t(title)}</h3>
                <p className="text-muted-foreground">{t(text)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Features */}
      <section className="bg-muted/40 px-4 py-16 md:py-24">
        <div className="container mx-auto">
          <div className="reveal mx-auto mb-12 max-w-2xl text-center">
            <h2 className="mb-3 text-3xl font-extrabold md:text-4xl">{t("home.featuresTitle")}</h2>
            <p className="text-lg text-muted-foreground">{t("home.featuresText")}</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, text, link }, i) => (
              <Link
                key={title}
                to={link}
                className="reveal group flex flex-col rounded-3xl border bg-card p-6 shadow-card transition-all hover:-translate-y-1 hover:border-primary/40"
                style={{ "--reveal-delay": `${(i % 4) * 70}ms` } as React.CSSProperties}
              >
                <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-brand/15 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mb-1 text-lg font-bold transition-colors group-hover:text-primary">{t(title)}</h3>
                <p className="flex-1 text-sm text-muted-foreground">{t(text)}</p>
                <ChevronRight className="mt-4 h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy promise */}
      <section className="px-4 py-16 md:py-24">
        <div className="reveal container relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-[hsl(262_40%_12%)] px-6 py-12 text-white md:px-12 md:py-16">
          <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[hsl(338_80%_57%/0.25)] blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-[hsl(264_66%_50%/0.35)] blur-3xl" />
          <div className="relative grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:items-center">
            <div>
              <Shield className="mb-4 h-10 w-10 text-[hsl(266_85%_78%)]" />
              <h2 className="mb-3 text-3xl font-extrabold md:text-4xl">{t("home.privacyTitle")}</h2>
              <p className="text-white/85">{t("home.privacyText")}</p>
              <Link to="/privacy" className="mt-4 inline-block font-semibold text-[hsl(266_85%_82%)] underline underline-offset-4">
                {t("footer.privacy")}
              </Link>
            </div>
            <ul className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              {PROMISES.map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex gap-4 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[hsl(266_85%_78%)]" />
                  <div>
                    <h3 className="font-bold">{t(title)}</h3>
                    <p className="text-sm text-white/80">{t(text)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Corporate Connect teaser */}
      <section className="px-4 pb-16 md:pb-24">
        <Link
          to="/corporate"
          className="reveal container group mx-auto flex max-w-6xl flex-col gap-4 rounded-3xl border bg-card p-6 shadow-card transition-colors hover:border-primary/40 sm:flex-row sm:items-center md:p-8"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Building2 className="h-6 w-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="mb-1 flex flex-wrap items-center gap-2">
              <span className="text-lg font-bold">{t("nav.corporate")}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">{t("home.comingSoon")}</span>
            </span>
            <span className="block text-muted-foreground">{t("home.corporateText")}</span>
          </span>
          <span className="inline-flex items-center gap-1 font-semibold text-primary">
            {t("home.corporateButton")} <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </span>
        </Link>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-br from-primary/10 to-brand/10 px-4 py-16 md:py-24">
        <div className="reveal container mx-auto max-w-3xl space-y-6 text-center">
          <h2 className="text-3xl font-extrabold md:text-4xl">
            {tr("home.ctaTitle", { highlight: <span className={highlight}>{t("home.ctaHighlight")}</span> })}
          </h2>
          <p className="text-lg text-muted-foreground">{t("home.ctaText")}</p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/signup">
              <Button variant="hero" size="lg" className="w-full gap-2 sm:w-auto">
                <Users className="h-5 w-5" />
                {t("home.ctaSignup")}
              </Button>
            </Link>
            <Link to="/about">
              <Button variant="glass" size="lg" className="w-full sm:w-auto">
                {t("home.ctaAbout")}
              </Button>
            </Link>
          </div>
        </div>
      </section>
      </main>

      <Footer />
    </div>
  );
};

export default Index;
