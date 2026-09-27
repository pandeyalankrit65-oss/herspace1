import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Copy, Footprints } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PageHeader from "@/components/PageHeader";
import LoadingRows from "@/components/LoadingRows";
import LiveLocation, { type LiveShare } from "@/components/LiveLocation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import type { Contact } from "./Contacts";

const DURATIONS = [30, 60, 120, 240];

function currentPosition(): Promise<{ lat: number; lng: number; accuracy: number } | undefined> {
  if (!navigator.geolocation) return Promise.resolve(undefined);
  return new Promise((resolve) =>
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => resolve(undefined),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 }
    )
  );
}

// "Walk with me": live location for confirmed contacts on a journey, without an alert.
const Walk = () => {
  const { t, tn } = useI18n();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [share, setShare] = useState<LiveShare | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [confirmed, setConfirmed] = useState<number | null>(null);
  const [minutes, setMinutes] = useState(60);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [manualLink, setManualLink] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api<{ share: LiveShare | null }>("/api/location-shares/active")
      .then((res) => setShare(res.share))
      .catch(() => {})
      .finally(() => setLoaded(true));
    api<{ contacts: Contact[] }>("/api/contacts")
      .then((res) => setConfirmed(res.contacts.filter((c) => c.status === "confirmed").length))
      .catch(() => setConfirmed(null));
  }, [user]);

  const ended = useCallback(() => {
    setShare(null);
    setManualLink(null);
  }, []);

  const start = async () => {
    setBusy(true);
    try {
      const coords = await currentPosition();
      const res = await api<{ share: LiveShare & { url: string }; sent: number; total: number }>("/api/location-shares", {
        body: { minutes, note: note.trim() || undefined, coords },
      });
      setShare({ ...res.share, acks: [] });
      if (res.sent > 0) toast({ title: tn("walk.sent", res.sent) });
      else setManualLink(res.share.url);
    } catch (err) {
      toast({ title: t("walk.startFailed"), description: (err as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const body = () => {
    if (!authLoading && !user) {
      return (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <p className="text-muted-foreground">{t("walk.loginDesc")}</p>
            <div className="flex gap-2">
              <Link to="/login?next=/walk" className="flex-1">
                <Button variant="hero" className="w-full">{t("common.logIn")}</Button>
              </Link>
              <Link to="/signup?next=/walk" className="flex-1">
                <Button variant="outline" className="w-full">{t("common.signUp")}</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      );
    }
    if (!loaded) return <LoadingRows rows={1} tall />;

    if (share) {
      return (
        <>
          <LiveLocation share={share} onEnded={ended} />
          {manualLink && (
            <Card>
              <CardContent className="space-y-3 pt-6">
                <p className="text-sm">{t("walk.notSent")}</p>
                <div className="flex gap-2">
                  <Input readOnly value={manualLink} onFocus={(e) => e.target.select()} />
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={t("common.copy")}
                    onClick={() => navigator.clipboard.writeText(manualLink).then(() => toast({ title: t("common.copied") }))}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          <Link to="/sos" className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm font-semibold">
            <AlertCircle className="h-5 w-5 shrink-0 text-destructive" /> {t("walk.sosHint")}
          </Link>
        </>
      );
    }

    return (
      <Card>
        <CardContent className="space-y-5 pt-6">
          {confirmed === 0 && (
            <div role="alert" className="space-y-2 rounded-xl border border-warning/50 bg-warning/10 px-4 py-3 text-sm">
              <p>{t("timer.noContacts")}</p>
              <Link to="/contacts" className="font-semibold underline underline-offset-2">
                {t("sos.contacts.manage")}
              </Link>
            </div>
          )}
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-semibold">{t("walk.duration")}</legend>
            <div className="grid grid-cols-4 gap-2">
              {DURATIONS.map((m) => (
                <Button key={m} type="button" variant={minutes === m ? "hero" : "outline"} aria-pressed={minutes === m} onClick={() => setMinutes(m)}>
                  {m >= 60 ? t("timer.hoursShort", { count: m / 60 }) : t("timer.minutesShort", { count: m })}
                </Button>
              ))}
            </div>
          </fieldset>
          <div className="space-y-1">
            <Label htmlFor="walk-note">{t("walk.note")}</Label>
            <Input id="walk-note" value={note} maxLength={120} placeholder={t("walk.notePlaceholder")} onChange={(e) => setNote(e.target.value)} />
          </div>
          <Button variant="hero" size="lg" className="w-full gap-2" onClick={start} disabled={busy || confirmed === 0}>
            <Footprints className="h-5 w-5" /> {busy ? t("walk.starting") : t("walk.start")}
          </Button>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="px-4 pb-16 pt-24">
        <div className="container mx-auto max-w-xl space-y-4">
          <PageHeader icon={Footprints} title={t("walk.title")} subtitle={t("walk.intro")} />
          {body()}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Walk;
