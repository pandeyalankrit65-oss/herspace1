import { Link } from "react-router-dom";
import { Shield, Heart, Users, AlertCircle, MessageCircle, Map, Building2, Quote, Timer, Phone } from "lucide-react";
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
  { icon: Shield, title: "home.feature.reportTitle", text: "home.feature.reportText", link: "/report" },
  { icon: MessageCircle, title: "home.feature.supportTitle", text: "home.feature.supportText", link: "/support" },
  { icon: Map, title: "home.feature.mapTitle", text: "home.feature.mapText", link: "/map" },
  { icon: Phone, title: "home.feature.fakeCallTitle", text: "home.feature.fakeCallText", link: "/sos" },
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

const CORPORATE_POINTS: MessageKey[] = ["home.corporatePoint1", "home.corporatePoint2", "home.corporatePoint3", "home.corporatePoint4"];

const cardClass =
  "bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50 hover:border-primary/50 transition-all hover:scale-105 duration-300";
const gradientText = "bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent";

const Index = () => {
  const { t, tr } = useI18n();

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero Section */}
      <section
        className="relative px-4 overflow-hidden min-h-[80vh] md:min-h-[90vh] pt-32 pb-24 md:pt-40 md:pb-40"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="absolute inset-0 opacity-60">
          <img src={heroImage} alt={t("home.heroImageAlt")} className="w-full h-full object-cover object-center" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/20 to-background/80" />

        <div className="container mx-auto relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-8 animate-fade-in mt-28 md:mt-40">
            <h1 className="text-5xl md:text-7xl font-bold leading-tight">
              <span className="bg-gradient-to-r from-primary via-accent to-cyan bg-clip-text text-transparent">
                {t("home.heroTitle1")}
              </span>
              <br />
              <span className="text-foreground">{t("home.heroTitle2")}</span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">{t("home.heroText")}</p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center pt-4">
              <Link to="/sos">
                <Button variant="hero" size="xl" className="gap-2 text-lg px-12 transition-all hover:scale-105">
                  <AlertCircle className="h-6 w-6" />
                  {t("home.setUpSos")}
                </Button>
              </Link>
              <Link to="/report">
                <Button variant="glass" size="xl" className="gap-2 text-lg px-12 transition-all hover:scale-105">
                  <Shield className="h-6 w-6" />
                  {t("home.reportIncident")}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Mission Statement */}
      <section className="py-20 px-4 bg-gradient-to-b from-card/40 to-background">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center space-y-8">
            <h2 className="text-4xl md:text-5xl font-bold mb-8">
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

      {/* Features Grid */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-4">
            <span className={gradientText}>{t("home.featuresTitle")}</span>
          </h2>
          <p className="text-center text-muted-foreground mb-12 text-lg">{t("home.featuresText")}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(({ icon: Icon, title, text, link }) => (
              <Link key={title} to={link}>
                <Card className={`group h-full cursor-pointer hover:shadow-[var(--glow-primary)] ${cardClass}`}>
                  <CardContent className="p-6 space-y-4">
                    <div className="p-3 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 w-fit group-hover:shadow-[var(--glow-primary)] transition-all">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold text-foreground group-hover:text-primary transition-colors">{t(title)}</h3>
                    <p className="text-muted-foreground">{t(text)}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
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
              <h2 className="text-4xl md:text-5xl font-bold">
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
            <Card className="bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-primary/30 hover:shadow-[var(--glow-primary)] transition-all">
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
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-4">
            <span className={gradientText}>{t("home.quotesTitle")}</span>
          </h2>
          <p className="text-center text-muted-foreground mb-12 text-lg">{t("home.quotesText")}</p>
          <div className="grid md:grid-cols-3 gap-8">
            {QUOTES.map(({ quote, author }) => (
              <Card key={quote} className={`hover:shadow-[var(--glow-primary)] ${cardClass}`}>
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
          <h2 className="text-4xl md:text-5xl font-bold">
            {tr("home.ctaTitle", { highlight: <span className={gradientText}>{t("home.ctaHighlight")}</span> })}
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
              <Button variant="glass" size="lg">{t("home.ctaAbout")}</Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;
