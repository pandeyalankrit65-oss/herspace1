import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BadgeCheck, MailWarning } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";

// Opened from the link in the confirmation email; works on any device, signed in or not.
const VerifyEmail = () => {
  const { t } = useI18n();
  const { token } = useParams();
  const { user, signedIn } = useAuth();
  const [state, setState] = useState<"checking" | "done" | "failed">("checking");
  const [error, setError] = useState("");
  const tried = useRef(false);

  useEffect(() => {
    if (tried.current) return;
    tried.current = true;
    api("/api/auth/verify-email", { body: { token } })
      .then(() => setState("done"))
      .catch((err: Error) => {
        setError(err.message);
        setState("failed");
      });
  }, [token]);

  // If they're signed in on this device, show it straight away.
  useEffect(() => {
    if (state === "done" && user && !user.emailVerified) signedIn({ ...user, emailVerified: true });
  }, [state, user, signedIn]);

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="px-4 pb-24 pt-28 md:pt-36">
        <div className="container mx-auto max-w-lg space-y-6 rounded-[2rem] bg-card p-8 text-center shadow-card ring-1 ring-border">
          {state === "checking" ? (
            <p className="text-muted-foreground">{t("verify.checking")}</p>
          ) : state === "done" ? (
            <>
              <BadgeCheck className="mx-auto h-12 w-12 text-success" />
              <h1 className="text-2xl font-extrabold">{t("verify.successTitle")}</h1>
              <p className="text-muted-foreground">{t("verify.successText")}</p>
              <Link to={user ? "/account" : "/login"}>
                <Button variant="hero">{user ? t("verify.toAccount") : t("common.logIn")}</Button>
              </Link>
            </>
          ) : (
            <>
              <MailWarning className="mx-auto h-12 w-12 text-destructive" />
              <h1 className="text-2xl font-extrabold">{t("verify.failedTitle")}</h1>
              <p className="text-muted-foreground">{error}</p>
              <Link to="/account">
                <Button variant="outline">{t("verify.toAccount")}</Button>
              </Link>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default VerifyEmail;
