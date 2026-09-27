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

const Login = () => {
  const navigate = useNavigate();
  const { t, tr } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [params] = useSearchParams();
  const { login, user, loading: authLoading } = useAuth();
  const next = safeNext(params.get("next"));

  // Already signed in (e.g. followed a ?next= link): go straight on.
  useEffect(() => {
    if (!authLoading && user) navigate(next, { replace: true });
  }, [authLoading, user, next, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError("");
    try {
      await login(email, password);
      navigate(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("login.failed"));
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
              <CardTitle className="text-2xl">{t("login.title")}</CardTitle>
              <CardDescription>{t("login.subtitle")}</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={onSubmit}>
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
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm block" htmlFor="password">
                      {t("common.password")}
                    </label>
                    <Link to="/forgot-password" className="text-xs text-primary underline underline-offset-2">
                      {t("login.forgot")}
                    </Link>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                {error && (
                  <p className="text-sm text-destructive" role="alert">
                    {error}
                  </p>
                )}
                <Button type="submit" variant="hero" className="w-full" disabled={loading}>
                  {loading ? t("login.submitting") : t("login.title")}
                </Button>
              </form>
              <p className="text-sm text-muted-foreground mt-4 text-center">
                {tr("login.noAccount", {
                  link: (
                    <Link to={`/signup${params.get("next") ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-primary underline underline-offset-2">
                      {t("common.signUp")}
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

export default Login;
