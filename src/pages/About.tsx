import { Shield, Heart, Users, Target, Eye, Lightbulb } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useI18n } from "@/i18n";
import type { MessageKey } from "@/i18n/en";

const VALUES: Array<{ icon: typeof Shield; title: MessageKey; text: MessageKey }> = [
  { icon: Shield, title: "about.value1Title", text: "about.value1Text" },
  { icon: Heart, title: "about.value2Title", text: "about.value2Text" },
  { icon: Users, title: "about.value3Title", text: "about.value3Text" },
  { icon: Lightbulb, title: "about.value4Title", text: "about.value4Text" },
];

const STATS: Array<[MessageKey, MessageKey]> = [
  ["about.stat1", "about.stat1Label"],
  ["about.stat2", "about.stat2Label"],
  ["about.stat3", "about.stat3Label"],
  ["about.stat4", "about.stat4Label"],
];

const About = () => {
  const { t } = useI18n();

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16 space-y-6">
            <h1 className="text-4xl md:text-6xl font-bold">
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">{t("about.title")}</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">{t("about.intro")}</p>
          </div>

          <Card className="mb-12 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/30">
            <CardHeader className="text-center">
              <Target className="h-12 w-12 mx-auto mb-4 text-primary" />
              <CardTitle className="text-3xl">{t("about.missionTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-center max-w-3xl mx-auto">
              <p className="text-lg text-muted-foreground leading-relaxed">{t("about.mission1")}</p>
              <p className="text-lg text-muted-foreground leading-relaxed">{t("about.mission2")}</p>
            </CardContent>
          </Card>

          <div className="mb-12 text-center space-y-4">
            <div className="flex justify-center mb-6">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20">
                <Eye className="h-12 w-12 text-primary" />
              </div>
            </div>
            <h2 className="text-3xl font-bold">{t("about.visionTitle")}</h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">{t("about.vision")}</p>
          </div>

          <div className="mb-12">
            <h2 className="text-3xl font-bold text-center mb-8">{t("about.valuesTitle")}</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {VALUES.map(({ icon: Icon, title, text }) => (
                <Card
                  key={title}
                  className="bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50 hover:border-primary/50 transition-all hover:shadow-[var(--glow-primary)]"
                >
                  <CardHeader>
                    <div className="p-3 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 w-fit mb-4">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-xl">{t(title)}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{t(text)}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <Card className="bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50 mb-12">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl">{t("about.journeyTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-center max-w-3xl mx-auto">
              <p className="text-muted-foreground leading-relaxed">{t("about.journey")}</p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
            {STATS.map(([value, label]) => (
              <Card key={value} className="bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50 text-center">
                <CardContent className="pt-6">
                  <div className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-2 break-words">
                    {t(value)}
                  </div>
                  <div className="text-sm text-muted-foreground">{t(label)}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="bg-gradient-to-br from-primary/10 to-accent/10 border-primary/30 text-center">
            <CardContent className="py-12 space-y-6">
              <h2 className="text-3xl font-bold">{t("about.ctaTitle")}</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{t("about.ctaText")}</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/signup">
                  <Button variant="hero" size="lg">{t("about.ctaSignup")}</Button>
                </Link>
                <Link to="/support">
                  <Button variant="glass" size="lg">{t("about.ctaSupport")}</Button>
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

export default About;
