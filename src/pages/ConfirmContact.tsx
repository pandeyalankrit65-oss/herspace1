import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { ContactStatus } from "./Contacts";
import { useI18n } from "@/i18n";

type Invite = { userName: string; contactName: string; status: ContactStatus };

// Opened by the person who was invited to be an emergency contact. No account needed.
const ConfirmContact = () => {
  const { token = "" } = useParams();
  const { t } = useI18n();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<Invite>(`/api/contact-invites/${encodeURIComponent(token)}`)
      .then(setInvite)
      .catch((err) => setError(err.message));
  }, [token]);

  const respond = async (accept: boolean) => {
    setSaving(true);
    try {
      const res = await api<{ status: ContactStatus }>(`/api/contact-invites/${encodeURIComponent(token)}`, { body: { accept } });
      setInvite((prev) => (prev ? { ...prev, status: res.status } : prev));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-lg">
          <Card className="bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50">
            {error && (
              <CardHeader>
                <CardTitle>{t("confirm.invalidTitle")}</CardTitle>
                <CardDescription>{error}</CardDescription>
              </CardHeader>
            )}
            {!error && !invite && (
              <CardContent className="pt-6 text-sm text-muted-foreground">{t("common.loading")}</CardContent>
            )}
            {invite && (
              <>
                <CardHeader>
                  <CardTitle>
                    {t("confirm.title", { name: invite.userName })}
                  </CardTitle>
                  <CardDescription>
                    {t("confirm.desc", { name: invite.userName })}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {invite.status === "confirmed" && (
                    <p className="text-sm rounded-md bg-green-500/10 border border-green-500/40 px-3 py-2">
                      {t("confirm.confirmed", { name: invite.userName })}
                    </p>
                  )}
                  {invite.status === "declined" && (
                    <p className="text-sm rounded-md bg-muted px-3 py-2">
                      {t("confirm.declined", { name: invite.userName })}
                    </p>
                  )}
                  <div className="flex flex-col sm:flex-row gap-2">
                    {invite.status !== "confirmed" && (
                      <Button variant="hero" className="flex-1" disabled={saving} onClick={() => respond(true)}>
                        {t("confirm.accept")}
                      </Button>
                    )}
                    {invite.status !== "declined" && (
                      <Button variant="outline" className="flex-1" disabled={saving} onClick={() => respond(false)}>
                        {invite.status === "confirmed" ? t("confirm.stop") : t("confirm.decline")}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </>
            )}
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ConfirmContact;
