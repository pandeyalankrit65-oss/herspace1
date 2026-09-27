import { Link } from "react-router-dom";
import { Shield, Heart, Users, AlertCircle, MessageCircle, Map, MapPin, Building2, Quote, Timer, Phone, CheckCircle2, Footprints, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
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

const MISSION: Array<{ icon: typeof Shield; title: MessageKey; text: MessageKey }> = [
  { icon: Shield, title: "home.mission1Title", text: "home.mission1Text" },
  { icon: Heart, title: "home.mission2Title", text: "home.mission2Text" },
  { icon: Users, title: "home.mission3Title", text: "home.mission3Text" },
  { icon: Building2, title: "home.mission4Title", text: "home.mission4Text" },
];

const WHY: Array<{ icon: typeof Shield; title: MessageKey; text: MessageKey }> = [
  { icon: Shield, title: "home.why1Title", text: "home.why1Text" },
  { icon: Heart, title: "home.why2Title", text: "home.why2Text" },
  { icon: Users, title: "home.why3Title", text: "home.why3Text" },
];

const QUOTES: Array<{ quote: MessageKey; author: MessageKey }> = [
  { quote: "home.quote1", author: "home.quote1Author" },
  { quote: "home.quote2", author: "home.quote2Author" },
  { quote: "home.quote3", author: "home.quote3Author" },
];

const CORPORATE_POINTS: MessageKey[] = [
  "home.corporatePoint1",
  "home.corporatePoint2",
  "home.corporatePoint3",
  "home.corporatePoint4",
];

const cardClass = " hover:border-primary/50 transition-all duration-300";
const gradientText = "text-foreground";
const highlight = "bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent";

const Index = () => {
  const { t, tr } = useI18n();

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden px-4 pb-16 pt-28 md:pb-24 md:pt-36">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[36rem] bg-[radial-gradient(60%_50%_at_30%_20%,hsl(var(--primary)/0.14),transparent)]" />
        <div className="container relative mx-auto grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
          <div className="space-y-7 text-center lg:text-left">
            <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground shadow-sm">
              <span className="h-2 w-2 rounded-full bg-success" /> {t("home.badge")}
            </span>
            <h1 className="text-4xl font-extrabold leading-[1.08] sm:text-5xl xl:text-6xl">
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">{t("home.heroTitle1")}</span>
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

      {/* Features Grid */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <h2 className="text-3xl md:text-4xl font-extrabold text-center mb-4">
            <span className={gradientText}>{t("home.featuresTitle")}</span>
          </h2>
          <p className="text-center text-muted-foreground mb-12 text-lg">{t("home.featuresText")}</p>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, text, link }) => (
              <Link key={title} to={link}>
                <Card className={`group h-full cursor-pointer ${cardClass}`}>
                  <CardContent className="p-6 space-y-4">
                    <div className="p-3 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 w-fit group- transition-all">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold text-foreground group-hover:text-primary transition-colors">
                      {t(title)}
                    </h3>
                    <p className="text-muted-foreground">{t(text)}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Mission Statement */}
      <section className="py-20 px-4 bg-gradient-to-b from-card/40 to-background">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center space-y-8">
            <h2 className="text-3xl md:text-4xl font-extrabold mb-8">
              <span className={gradientText}>{t("home.missionTitle")}</span>
            </h2>
            <div className="grid md:grid-cols-2 gap-8 text-left">
              {MISSION.map(({ icon: Icon, title, text }) => (
                <Card key={title} className={cardClass}>
                  <CardContent className="p-8 space-y-4">
                    <Icon className="h-12 w-12 text-primary mb-4" />
                    <h3 className="text-2xl font-bold">{t(title)}</h3>
                    <p className="text-muted-foreground leading-relaxed">{t(text)}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Corporate Connect Section */}
      <section className="py-20 px-4 bg-gradient-to-br from-primary/10 via-accent/5 to-background">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="inline-block p-4 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20">
                <Building2 className="h-12 w-12 text-primary" />
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold">
                <span className={gradientText}>{t("nav.corporate")}</span>
              </h2>
              <p className="text-xl text-muted-foreground leading-relaxed">{t("home.corporateText")}</p>
              <ul className="space-y-4">
                {CORPORATE_POINTS.map((key) => (
                  <li key={key} className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <span className="text-muted-foreground">{t(key)}</span>
                  </li>
                ))}
              </ul>
              <Link to="/corporate">
                <Button variant="hero" size="lg" className="gap-2 mt-4">
                  <Building2 className="h-5 w-5" />
                  {t("home.corporateButton")}
                </Button>
              </Link>
            </div>
            <Card className="border-primary/30 transition-all">
              <CardContent className="p-8 space-y-6">
                <h3 className="text-2xl font-bold">{t("home.whyTitle")}</h3>
                <div className="space-y-4">
                  {WHY.map(({ icon: Icon, title, text }) => (
                    <div key={title} className="flex gap-4">
                      <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1">{t(title)}</h4>
                        <p className="text-sm text-muted-foreground">{t(text)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Quotes */}
      <section className="py-20 px-4 bg-gradient-to-b from-background to-card/40">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl md:text-4xl font-extrabold text-center mb-4">
            <span className={gradientText}>{t("home.quotesTitle")}</span>
          </h2>
          <p className="text-center text-muted-foreground mb-12 text-lg">{t("home.quotesText")}</p>
          <div className="grid md:grid-cols-3 gap-8">
            {QUOTES.map(({ quote, author }) => (
              <Card key={quote} className={` ${cardClass}`}>
                <CardContent className="p-8 space-y-4">
                  <Quote className="h-10 w-10 text-primary/50" />
                  <p className="text-lg italic text-muted-foreground leading-relaxed">"{t(quote)}"</p>
                  <p className="text-sm font-semibold text-primary">— {t(author)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-br from-primary/10 to-accent/10">
        <div className="container mx-auto max-w-4xl text-center space-y-8">
          <h2 className="text-3xl md:text-4xl font-extrabold">
            {tr("home.ctaTitle", { highlight: <span className={highlight}>{t("home.ctaHighlight")}</span> })}
          </h2>
          <p className="text-xl text-muted-foreground leading-relaxed">{t("home.ctaText")}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/signup">
              <Button variant="hero" size="lg" className="gap-2">
                <Users className="h-5 w-5" />
                {t("home.ctaSignup")}
              </Button>
            </Link>
            <Link to="/about">
              <Button variant="glass" size="lg">
                {t("home.ctaAbout")}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;
