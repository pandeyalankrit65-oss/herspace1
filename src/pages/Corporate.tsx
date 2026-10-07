import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, BarChart3, Bell, Building2, EyeOff, MessagesSquare } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/i18n";
import type { MessageKey } from "@/i18n/en";
import { api } from "@/lib/api";
import EmployeeView from "@/components/workplace/EmployeeView";
import HrView, { NewCode } from "@/components/workplace/HrView";
import JoinOrSetup from "@/components/workplace/JoinOrSetup";
import type { Org } from "@/components/workplace/types";

const POINTS: Array<{
  icon: typeof EyeOff;
  title: MessageKey;
  text: MessageKey;
}> = [
  { icon: EyeOff, title: "work.point1Title", text: "work.point1Text" },
  { icon: MessagesSquare, title: "work.point2Title", text: "work.point2Text" },
  { icon: BarChart3, title: "work.point3Title", text: "work.point3Text" },
  { icon: Bell, title: "work.point4Title", text: "work.point4Text" },
];

// Corporate Connect: confidential workplace reporting to HR, and HR's dashboard.
const Corporate = () => {
  const { t } = useI18n();
  const { user, loading } = useAuth();
  const [org, setOrg] = useState<Org | null | undefined>(undefined);
  const [newCode, setNewCode] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api<{ org: Org | null }>("/api/workplace")
      .then((r) => setOrg(r.org))
      .catch(() => setOrg(null));
  }, [user]);

  const left = () => {
    setOrg(null);
    setNewCode(null);
  };

  const body = () => {
    if (!loading && !user) {
      return (
        <div className="space-y-10">
          <div className="grid gap-5 sm:grid-cols-2">
            {POINTS.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border">
                <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-brand text-white shadow-raised">
                  <Icon className="h-6 w-6" />
                </span>
                <h2 className="mb-1 text-lg font-bold">{t(title)}</h2>
                <p className="text-muted-foreground">{t(text)}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-muted-foreground">{t("work.loginText")}</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link to="/login?next=/corporate">
                <Button variant="hero" size="lg" className="w-full sm:w-auto">
                  {t("common.logIn")}
                </Button>
              </Link>
              <Link to="/signup?next=/corporate">
                <Button variant="glass" size="lg" className="w-full sm:w-auto">
                  {t("common.signUp")}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      );
    }
    if (org === undefined) return <div className="h-64 animate-pulse rounded-[2rem] bg-muted" />;
    if (org === null) {
      return (
        <JoinOrSetup
          onJoined={setOrg}
          onCreated={(o, code) => {
            setOrg(o);
            setNewCode(code);
          }}
        />
      );
    }
    return (
      <div className="space-y-8">
        <div className="flex flex-wrap items-center gap-3 rounded-[2rem] bg-card p-5 shadow-card ring-1 ring-border">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Building2 className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xl font-extrabold">{org.name}</p>
            <p className="text-sm text-muted-foreground">{org.role === "hr" ? t("work.youAreHr") : t("work.youAreMember")}</p>
          </div>
          {org.verified && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1.5 text-sm font-semibold ring-1 ring-success/30">
              <BadgeCheck className="h-4 w-4 text-success" /> {t("work.verified", { domain: org.emailDomain ?? "" })}
            </span>
          )}
        </div>
        {newCode && <NewCode code={newCode} />}
        {org.role === "hr" ? <HrView onLeave={left} /> : <EmployeeView onLeave={left} />}
      </div>
    );
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="px-4 pb-24 pt-28 md:pt-36">
        <div className="container mx-auto max-w-6xl space-y-12">
          <header className="mx-auto max-w-3xl space-y-5 text-center">
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-primary">{t("work.kicker")}</p>
            <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">{t("nav.corporate")}</h1>
            <p className="text-lg leading-relaxed text-muted-foreground md:text-xl">{t("work.intro")}</p>
          </header>
          {body()}
          <p className="mx-auto max-w-2xl text-center text-sm text-muted-foreground">
            {t("work.emergency")}{" "}
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

export default Corporate;
