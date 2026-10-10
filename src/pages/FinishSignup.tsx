import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth, type User } from "@/contexts/AuthContext";
import { ApiError, api } from "@/lib/api";
import { safeNext } from "@/lib/utils";
import { useI18n } from "@/i18n";

// Opened from the sign-up email: she chooses her password here, and the account is created.
const FinishSignup = () => {
  const { token = "" } = useParams();
  const { t } = useI18n();
  const navigate = useNavigate();
  const { signedIn } = useAuth();
  const [email, setEmail] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // "expired": sign up again; "exists": log in instead.
  const [dead, setDead] = useState<"expired" | "exists" | null>(null);

  useEffect(() => {
    api<{ name: string; email: string }>("/api/auth/signup/pending", {
      body: { token },
    })
      .then((p) => {
        setEmail(p.email);
        setName(p.name);
      })
      .catch(() => setDead("expired"));
  }, [token]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError(t("reset.mismatch"));
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await api<{ user: User; next: string | null }>(
        "/api/auth/signup/finish",
        { body: { token, name, password } },
      );
      signedIn(res.user);
      // New accounts go straight to adding emergency contacts unless a specific page was asked for.
      navigate(safeNext(res.next, "/contacts"), { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setDead("exists");
      else if (
        err instanceof ApiError &&
        err.status === 400 &&
        /expired/i.test(err.message)
      )
        setDead("expired");
      else setError((err as Error).message);
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
              <CardTitle className="text-2xl">{t("finish.title")}</CardTitle>
              {email && (
                <CardDescription>
                  {t("finish.subtitle", { email })}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {dead ? (
                <div className="space-y-4 text-center" role="alert">
                  <p>
                    {dead === "exists"
                      ? t("finish.exists")
                      : t("finish.expired")}
                  </p>
                  <Button asChild variant="hero">
                    <Link to={dead === "exists" ? "/login" : "/signup"}>
                      {dead === "exists"
                        ? t("common.logIn")
                        : t("finish.again")}
                    </Link>
                  </Button>
                </div>
              ) : email === null ? (
                <div className="h-48 animate-pulse rounded-xl bg-muted" />
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
                    <label className="text-sm mb-1 block" htmlFor="password">
                      {t("common.password")}
                    </label>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("common.minChars")}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm mb-1 block" htmlFor="confirm">
                      {t("finish.confirm")}
                    </label>
                    <Input
                      id="confirm"
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                    />
                  </div>
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
                    {loading ? t("finish.submitting") : t("finish.submit")}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default FinishSignup;
