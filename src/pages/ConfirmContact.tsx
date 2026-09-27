import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { ContactStatus } from "./Contacts";

type Invite = { userName: string; contactName: string; status: ContactStatus };

// Opened by the person who was invited to be an emergency contact. No account needed.
const ConfirmContact = () => {
  const { token = "" } = useParams();
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
                <CardTitle>Link not valid</CardTitle>
                <CardDescription>{error}</CardDescription>
              </CardHeader>
            )}
            {!error && !invite && (
              <CardContent className="pt-6 text-sm text-muted-foreground">Loading...</CardContent>
            )}
            {invite && (
              <>
                <CardHeader>
                  <CardTitle>
                    {invite.userName} wants you as an emergency contact
                  </CardTitle>
                  <CardDescription>
                    If {invite.userName} presses the SOS button in the HerSpace app, you'll get a text message with a link to
                    their location, and possibly an automated phone call. If that happens, call them straight away, and
                    contact local emergency services if you can't reach them.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {invite.status === "confirmed" && (
                    <p className="text-sm rounded-md bg-green-500/10 border border-green-500/40 px-3 py-2">
                      You're confirmed as {invite.userName}'s emergency contact. Thank you. You can come back to this link to opt out at any time.
                    </p>
                  )}
                  {invite.status === "declined" && (
                    <p className="text-sm rounded-md bg-muted px-3 py-2">
                      You've declined. You won't receive alerts from {invite.userName}.
                    </p>
                  )}
                  <div className="flex flex-col sm:flex-row gap-2">
                    {invite.status !== "confirmed" && (
                      <Button variant="hero" className="flex-1" disabled={saving} onClick={() => respond(true)}>
                        Yes, I'll be a contact
                      </Button>
                    )}
                    {invite.status !== "declined" && (
                      <Button variant="outline" className="flex-1" disabled={saving} onClick={() => respond(false)}>
                        {invite.status === "confirmed" ? "Stop receiving alerts" : "No thanks"}
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
