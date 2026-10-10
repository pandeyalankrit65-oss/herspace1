import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { MailCheck } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { safeNext } from "@/lib/utils";
import { useI18n } from "@/i18n";

const Signup = () => {
  const navigate = useNavigate();
  const { t, tr } = useI18n();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [params] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  // New accounts go straight to adding emergency contacts unless a specific page was requested.
  const next = params.get("next") ? safeNext(params.get("next")) : "/contacts";

  // Already signed in (e.g. followed a ?next= link): go straight on.
  useEffect(() => {
    if (!authLoading && user) navigate(next, { replace: true });
  }, [authLoading, user, next, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !name) return;
    setLoading(true);
    setError("");
    try {
      // The same answer whether or not the email has an account: the inbox gets the next step.
      await api("/api/auth/signup", {
        body: { name, email, next: next === "/contacts" ? undefined : next },
      });
      setSentTo(email.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : t("signup.failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-md">
          <Card>
            <CardHeader className="text-center space-y-2">
              <CardTitle className="text-2xl">{t("signup.title")}</CardTitle>
              <CardDescription>{t("signup.subtitle")}</CardDescription>
            </CardHeader>
            <CardContent>
              {sentTo ? (
                <div className="space-y-4 text-center" role="status">
                  <MailCheck
                    className="mx-auto h-10 w-10 text-primary"
                    aria-hidden
                  />
                  <h2 className="text-lg font-bold">
                    {t("signup.checkTitle")}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {t("signup.checkText", { email: sentTo })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t("signup.checkSpam")}
                  </p>
                  <p className="text-sm">
                    {tr("signup.sosNow", {
                      link: (
                        <Link
                          to="/sos"
                          className="text-primary underline underline-offset-2"
                        >
                          {t("signup.sosLink")}
                        </Link>
                      ),
                    })}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSentTo("")}
                  >
                    {t("signup.changeEmail")}
                  </Button>
                </div>
              ) : (
                <form className="space-y-4" onSubmit={onSubmit}>
                  <div>
                    <label className="text-sm mb-1 block" htmlFor="name">
                      {t("common.name")}
                    </label>
                    <Input
                      id="name"
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm mb-1 block" htmlFor="email">
                      {t("common.email")}
                    </label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("signup.howItWorks")}
                  </p>
                  {error && (
                    <p className="text-sm text-destructive" role="alert">
                      {error}
                    </p>
                  )}
                  <Button
                    type="submit"
                    variant="hero"
                    className="w-full"
                    disabled={loading}
                  >
                    {loading ? t("signup.submitting") : t("signup.submit")}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    {tr("signup.agree", {
                      terms: (
                        <Link to="/terms" className="underline">
                          {t("footer.terms")}
                        </Link>
                      ),
                      privacy: (
                        <Link to="/privacy" className="underline">
                          {t("footer.privacy")}
                        </Link>
                      ),
                    })}
                  </p>
                </form>
              )}
              <p className="text-sm text-muted-foreground mt-4 text-center">
                {tr("signup.haveAccount", {
                  link: (
                    <Link
                      to={`/login${params.get("next") ? `?next=${encodeURIComponent(next)}` : ""}`}
                      className="text-primary underline underline-offset-2"
                    >
                      {t("common.logIn")}
                    </Link>
                  ),
                })}
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Signup;
