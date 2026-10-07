import { useState } from "react";
import { BadgeCheck, Mail } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";

// Proving the email address is theirs: needed to be "verified" in a workplace or circle on its
// domain, to confirm others' map reports, and (with a phone) to be a verified reporter.
const EmailVerification = () => {
  const { t } = useI18n();
  const { toast } = useToast();
  const { user } = useAuth();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  if (!user) return null;

  const send = async () => {
    setSending(true);
    try {
      await api("/api/auth/verify-email/send", { method: "POST" });
      setSent(true);
      toast({ title: t("verify.sentTitle"), description: t("verify.sentText", { email: user.email }) });
    } catch (err) {
      toast({ title: t("verify.sendFailed"), description: (err as Error).message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {user.emailVerified ? <BadgeCheck className="h-5 w-5 text-success" /> : <Mail className="h-5 w-5 text-primary" />}
          {t("verify.title")}
        </CardTitle>
        <CardDescription>{user.emailVerified ? t("verify.done", { email: user.email }) : t("verify.why")}</CardDescription>
      </CardHeader>
      {!user.emailVerified && (
        <CardContent className="space-y-2">
          <p className="text-sm">{t("verify.pending", { email: user.email })}</p>
          <Button type="button" variant="outline" onClick={send} disabled={sending}>
            {sent ? t("verify.resend") : t("verify.send")}
          </Button>
        </CardContent>
      )}
    </Card>
  );
};

export default EmailVerification;
