import { useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useI18n } from "@/i18n";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api("/api/auth/forgot", { body: { email } });
      setSent(true);
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
          <Card>
            <CardHeader className="text-center space-y-2">
              <CardTitle className="text-2xl">{t("forgot.title")}</CardTitle>
              <CardDescription>{sent ? t("forgot.sent") : t("forgot.prompt")}</CardDescription>
            </CardHeader>
            <CardContent>
              {!sent && (
                <form className="space-y-4" onSubmit={onSubmit}>
                  <div>
                    <label className="text-sm mb-1 block" htmlFor="email">
                      {t("common.email")}
                    </label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  {error && (
                    <p className="text-sm text-destructive" role="alert">
                      {error}
                    </p>
                  )}
                  <Button type="submit" variant="hero" className="w-full" disabled={loading}>
                    {loading ? t("forgot.sending") : t("forgot.submit")}
                  </Button>
                </form>
              )}
              <p className="text-sm text-muted-foreground mt-4 text-center">
                <Link to="/login" className="text-primary underline underline-offset-2">
                  {t("forgot.back")}
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ForgotPassword;
