import { Building2, ShieldCheck, UserCheck, FileText, MessageCircle, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useI18n } from "@/i18n";
import type { MessageKey } from "@/i18n/en";

const FEATURES: Array<{ icon: typeof Lock; title: MessageKey; text: MessageKey }> = [
  { icon: ShieldCheck, title: "corporate.feature1Title", text: "corporate.feature1Text" },
  { icon: UserCheck, title: "corporate.feature2Title", text: "corporate.feature2Text" },
  { icon: FileText, title: "corporate.feature3Title", text: "corporate.feature3Text" },
  { icon: Lock, title: "corporate.feature4Title", text: "corporate.feature4Text" },
];

const STEPS: Array<{ step: string; title: MessageKey; text: MessageKey }> = [
  { step: "01", title: "corporate.step1Title", text: "corporate.step1Text" },
  { step: "02", title: "corporate.step2Title", text: "corporate.step2Text" },
  { step: "03", title: "corporate.step3Title", text: "corporate.step3Text" },
];

const gradientText = "bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent";

const Corporate = () => {
  const { t, tr } = useI18n();

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16 space-y-6 animate-fade-in">
            <div className="inline-block p-4 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 mb-4">
              <Building2 className="h-16 w-16 text-primary" />
            </div>
            <h1 className="text-4xl md:text-6xl font-bold">
              <span className="bg-gradient-to-r from-primary via-accent to-cyan bg-clip-text text-transparent">{t("nav.corporate")}</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">{t("corporate.intro")}</p>
            <p className="text-sm rounded-md border border-primary/40 bg-primary/10 px-4 py-2 max-w-2xl mx-auto">{t("corporate.notYet")}</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/report">
                <Button variant="hero" size="xl" className="gap-2 animate-glow-pulse">
                  <FileText className="h-5 w-5" />
                  {t("corporate.reportButton")}
                </Button>
              </Link>
              <Link to="/support">
                <Button variant="glass" size="xl" className="gap-2">
                  <MessageCircle className="h-5 w-5" />
                  {t("corporate.supportButton")}
                </Button>
              </Link>
            </div>
          </div>

          <section className="mb-16">
            <Card className="bg-gradient-to-br from-primary/10 to-accent/10 border-primary/30">
              <CardHeader className="text-center">
                <CardTitle className="text-3xl">{t("corporate.whyTitle")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-center max-w-3xl mx-auto">
                <p className="text-lg text-muted-foreground leading-relaxed">{t("corporate.why1")}</p>
                <p className="text-lg text-muted-foreground leading-relaxed">{t("corporate.why2")}</p>
              </CardContent>
            </Card>
          </section>

          <section className="mb-16">
            <h2 className="text-3xl font-bold text-center mb-12">
              {tr("corporate.supportTitle", { highlight: <span className={gradientText}>{t("corporate.supportHighlight")}</span> })}
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <Card
                  key={title}
                  className="group bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50 hover:border-primary/50 transition-all hover:shadow-[var(--glow-primary)] hover:scale-105 duration-300"
                >
                  <CardHeader>
                    <div className="p-3 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 w-fit mb-4 group-hover:shadow-[var(--glow-primary)] transition-all">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-xl">{t(title)}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-base">{t(text)}</CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section className="mb-16">
            <h2 className="text-3xl font-bold text-center mb-12">{t("corporate.howTitle")}</h2>
            <div className="grid md:grid-cols-3 gap-8">
              {STEPS.map(({ step, title, text }) => (
                <div key={step} className="text-center space-y-4">
                  <div className={`text-5xl font-bold ${gradientText}`}>{step}</div>
                  <h3 className="text-xl font-semibold">{t(title)}</h3>
                  <p className="text-muted-foreground">{t(text)}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mb-16">
            <Card className="bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50">
              <CardHeader className="text-center">
                <Building2 className="h-12 w-12 mx-auto mb-4 text-primary" />
                <CardTitle className="text-2xl">{t("corporate.partnersTitle")}</CardTitle>
                <CardDescription>{t("corporate.partnersText")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-primary" />
                      {t("corporate.partner1Title")}
                    </h4>
                    <p className="text-sm text-muted-foreground">{t("corporate.partner1Text")}</p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      <UserCheck className="h-5 w-5 text-primary" />
                      {t("corporate.partner2Title")}
                    </h4>
                    <p className="text-sm text-muted-foreground">{t("corporate.partner2Text")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <Card className="bg-gradient-to-br from-destructive/10 to-red-900/10 border-destructive/30">
            <CardHeader>
              <CardTitle>{t("corporate.helpTitle")}</CardTitle>
              <CardDescription>{t("corporate.helpText")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/sos" className="flex-1">
                  <Button variant="emergency" size="lg" className="w-full">{t("common.emergencySos")}</Button>
                </Link>
                <Link to="/support" className="flex-1">
                  <Button variant="hero" size="lg" className="w-full">{t("support.title")}</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Corporate;
