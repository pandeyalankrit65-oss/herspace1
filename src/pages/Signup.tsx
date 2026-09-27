import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { safeNext } from "@/lib/utils";
import { useI18n } from "@/i18n";

const Signup = () => {
  const navigate = useNavigate();
  const { t, tr } = useI18n();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [params] = useSearchParams();
  const { signup, user, loading: authLoading } = useAuth();
  // New accounts go straight to adding emergency contacts unless a specific page was requested.
  const next = params.get("next") ? safeNext(params.get("next")) : "/contacts";

  // Already signed in (e.g. followed a ?next= link): go straight on.
  useEffect(() => {
    if (!authLoading && user) navigate(next, { replace: true });
  }, [authLoading, user, next, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !name) return;
    setLoading(true);
    setError("");
    try {
      await signup(name, email, password);
      navigate(next);
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
          <Card className="bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50">
            <CardHeader className="text-center space-y-2">
              <CardTitle className="text-2xl">{t("signup.title")}</CardTitle>
              <CardDescription>{t("signup.subtitle")}</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={onSubmit}>
                <div>
                  <label className="text-sm mb-1 block" htmlFor="name">{t("common.name")}</label>
                  <Input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div>
                  <label className="text-sm mb-1 block" htmlFor="email">{t("common.email")}</label>
                  <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div>
                  <label className="text-sm mb-1 block" htmlFor="password">{t("common.password")}</label>
                  <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
                  <p className="text-xs text-muted-foreground mt-1">{t("common.minChars")}</p>
                </div>
                {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
                <Button type="submit" variant="hero" className="w-full" disabled={loading}>
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
              <p className="text-sm text-muted-foreground mt-4 text-center">
                {tr("signup.haveAccount", {
                  link: (
                    <Link to={`/login${params.get("next") ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-primary">
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
