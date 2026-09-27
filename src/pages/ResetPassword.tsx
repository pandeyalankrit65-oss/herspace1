import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth, type User } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { useI18n } from "@/i18n";

const ResetPassword = () => {
  const { token = "" } = useParams();
  const { t } = useI18n();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signedIn } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError(t("reset.mismatch"));
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await api<{ user: User }>("/api/auth/reset", { body: { token, password } });
      signedIn(res.user);
      toast({ title: t("reset.doneTitle"), description: t("reset.doneDesc") });
      navigate("/");
    } catch (err) {
      setError((err as Error).message);
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
              <CardTitle className="text-2xl">{t("reset.title")}</CardTitle>
              <CardDescription>{t("common.minChars")}</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={onSubmit}>
                <div>
                  <label className="text-sm mb-1 block" htmlFor="password">{t("reset.new")}</label>
                  <Input id="password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <div>
                  <label className="text-sm mb-1 block" htmlFor="confirm">{t("reset.confirm")}</label>
                  <Input id="confirm" type="password" autoComplete="new-password" minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
                </div>
                {error && (
                  <p className="text-sm text-destructive" role="alert">
                    {error}{" "}
                    {/expired|invalid/i.test(error) && <Link to="/forgot-password" className="underline">{t("reset.requestNew")}</Link>}
                  </p>
                )}
                <Button type="submit" variant="hero" className="w-full" disabled={loading}>
                  {loading ? t("common.saving") : t("reset.submit")}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ResetPassword;
