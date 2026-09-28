import { useState } from "react";
import { BadgeCheck, Smartphone } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";

// The user's own number, proved with a texted code. Alerts and invites then show it, so
// contacts recognise who is asking for help and can call back.
const PhoneVerification = () => {
  const { t } = useI18n();
  const { toast } = useToast();
  const { user, signedIn } = useAuth();
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!user) return null;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const sendCode = () =>
    run(async () => {
      const res = await api<{ phone: string }>("/api/account/phone", { body: { phone } });
      setSentTo(res.phone);
      setCode("");
    });

  const verify = () =>
    run(async () => {
      const res = await api<{ phone: string }>("/api/account/phone/verify", { body: { code } });
      signedIn({ ...user, phone: res.phone });
      setEditing(false);
      setSentTo(null);
      toast({ title: t("phone.verified") });
    });

  const remove = () =>
    run(async () => {
      await api("/api/account/phone", { method: "DELETE" });
      signedIn({ ...user, phone: null });
    });

  const showForm = editing || !user.phone;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-primary" /> {t("phone.title")}
        </CardTitle>
        <CardDescription>{t("phone.desc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {user.phone && !editing && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-success/40 bg-success/10 p-3">
            <span className="flex items-center gap-2 font-semibold">
              <BadgeCheck className="h-5 w-5 text-success" /> {user.phone}
              <span className="text-sm font-normal text-muted-foreground">{t("phone.verifiedTag")}</span>
            </span>
            <span className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                {t("phone.change")}
              </Button>
              <Button variant="ghost" size="sm" onClick={remove} disabled={busy}>
                {t("phone.remove")}
              </Button>
            </span>
          </div>
        )}

        {showForm && !sentTo && (
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              sendCode();
            }}
          >
            <Label htmlFor="own-phone">{t("phone.label")}</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="own-phone"
                type="tel"
                autoComplete="tel"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
              <Button type="submit" variant="hero" disabled={busy || !phone.trim()} className="shrink-0">
                {busy ? t("phone.sending") : t("phone.sendCode")}
              </Button>
            </div>
          </form>
        )}

        {showForm && sentTo && (
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              verify();
            }}
          >
            <Label htmlFor="phone-code">{t("phone.codeLabel", { phone: sentTo })}</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="phone-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="font-mono tracking-[0.3em]"
                required
              />
              <Button type="submit" variant="hero" disabled={busy || code.length !== 6} className="shrink-0">
                {t("phone.verify")}
              </Button>
            </div>
            <button type="button" className="text-sm font-semibold text-primary underline underline-offset-2" onClick={() => setSentTo(null)}>
              {t("phone.differentNumber")}
            </button>
          </form>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default PhoneVerification;
