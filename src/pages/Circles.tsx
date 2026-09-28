import { Users, Lock, Building2, GraduationCap, Heart, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useI18n } from "@/i18n";
import type { MessageKey } from "@/i18n/en";
import PageHeader from "@/components/PageHeader";

const CIRCLES: Array<{ name: MessageKey; category: MessageKey; icon: typeof Users; text: MessageKey }> = [
  { name: "circles.tech", category: "circles.category.corporate", icon: Building2, text: "circles.techText" },
  { name: "circles.campus", category: "circles.category.college", icon: GraduationCap, text: "circles.campusText" },
  { name: "circles.health", category: "circles.category.corporate", icon: Heart, text: "circles.healthText" },
  { name: "circles.local", category: "circles.category.community", icon: Users, text: "circles.localText" },
];

const FEATURES: Array<{ icon: typeof Lock; title: MessageKey; text: MessageKey }> = [
  { icon: Lock, title: "circles.privateTitle", text: "circles.privateText" },
  { icon: MessageSquare, title: "circles.moderatedTitle", text: "circles.moderatedText" },
  { icon: Users, title: "circles.connectTitle", text: "circles.connectText" },
];

const Circles = () => {
  const { t } = useI18n();

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <PageHeader icon={Users} title={t("circles.title")} subtitle={t("circles.intro")} />

          <Card className="mb-8 bg-primary/5 border-primary/20">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" />
                <CardTitle>{t("circles.comingSoon")}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{t("circles.notice")}</p>
            </CardContent>
          </Card>

          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6">{t("circles.planned")}</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {CIRCLES.map(({ name, category, icon: Icon, text }) => (
                <Card key={name} className="group hover:border-primary/50 transition-all">
                  <CardHeader>
                    <div className="p-3 w-fit rounded-lg bg-gradient-to-br from-primary/20 to-brand/20 group- transition-all">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="mt-4">{t(name)}</CardTitle>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Badge variant="outline">{t(category)}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">{t(text)}</p>
                    <Button variant="hero" className="w-full" disabled>
                      {t("circles.comingSoon")}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <Card key={title}>
                <CardHeader>
                  <Icon className="h-8 w-8 text-primary mb-2" />
                  <CardTitle className="text-lg">{t(title)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{t(text)}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle>{t("circles.createTitle")}</CardTitle>
              <CardDescription>{t("circles.createText")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/about">
                <Button variant="hero" size="lg">
                  {t("circles.createButton")}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Circles;
