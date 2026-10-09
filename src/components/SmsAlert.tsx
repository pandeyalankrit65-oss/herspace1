import { useEffect, useState } from "react";
import { MessageSquareWarning } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";

// Alert by text message: "HELP" from her verified phone to HerSpace's number alerts her contacts.
// For a basic phone, or when the app can't be opened. Shown only when incoming texts are set up.
const SmsAlert = () => {
  const { t } = useI18n();
  const { user } = useAuth();
  const [number, setNumber] = useState<string | null>(null);
  useEffect(() => {
    api<{ number: string | null }>("/api/sms-alert")
      .then((res) => setNumber(res.number))
      .catch(() => setNumber(null));
  }, []);
  if (!user || !number) return null;
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
      </CardContent>
    </Card>
  );
};

export default SmsAlert;
