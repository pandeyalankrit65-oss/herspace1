import { useEffect, useState } from "react";
import { MessageSquareWarning, PhoneMissed } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

// Alert by text message: "HELP" from her verified phone to HerSpace's number alerts her contacts.
// Or, once she turns it on, a missed call to the same number (no balance or data needed).
// For a basic phone, or when the app can't be opened. Shown only when incoming texts are set up.
const SmsAlert = () => {
  const { t } = useI18n();
  const { user, signedIn } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [number, setNumber] = useState<string | null>(null);
  useEffect(() => {
    api<{ number: string | null }>("/api/sms-alert")
      .then((res) => setNumber(res.number))
      .catch(() => setNumber(null));
  }, []);
  if (!user || !number) return null;
  const setMissedCall = async (on: boolean) => {
    setSaving(true);
    try {
      await api("/api/account/missed-call", { method: "PUT", body: { on } });
      signedIn({ ...user, missedCallSos: on });
    } catch (err) {
      toast({ title: t("smsAlert.missedFailed"), description: (err as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquareWarning className="h-5 w-5 text-primary" /> {t("smsAlert.title")}
        </CardTitle>
        <CardDescription>{t("smsAlert.desc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {user.phone ? (
          <p className="font-medium">{t("smsAlert.how", { phone: user.phone, number })}</p>
        ) : (
          <p>{t("smsAlert.needPhone")}</p>
        )}
        <p className="text-xs text-muted-foreground">{t("smsAlert.note")}</p>
        {user.phone && (
          <div className="flex items-start gap-3 rounded-xl border bg-muted/40 p-3">
            <PhoneMissed className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <label htmlFor="missed-call-toggle" className="font-semibold">
                {t("smsAlert.missedLabel")}
              </label>
              <p className="text-xs text-muted-foreground">
                {user.missedCallSos ? t("smsAlert.missedOn", { phone: user.phone, number }) : t("smsAlert.missedHint")}
              </p>
            </div>
            <Switch id="missed-call-toggle" checked={Boolean(user.missedCallSos)} disabled={saving} onCheckedChange={setMissedCall} />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SmsAlert;
