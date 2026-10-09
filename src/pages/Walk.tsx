import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertCircle, Car, Copy, Footprints, MapPin, Timer, Users } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PageHeader from "@/components/PageHeader";
import NeedsInternet from "@/components/NeedsInternet";
import { useOnline } from "@/lib/offline";
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
import { currentPosition } from "@/lib/location";
import { journeyDestination, usePlaces, type SavedPlace } from "@/lib/places";
import DestinationSearch from "@/components/trip/DestinationSearch";
import TripCheck from "@/components/trip/TripCheck";
import RoutineReminder from "@/components/routines/RoutineReminder";
import RoutinesManager from "@/components/routines/RoutinesManager";
import { readRoutines } from "@/lib/routines";
import { MicClues, SafetyCheckPrompt, SafetyCheckToggle } from "@/components/SafetyCheck";
import StayWithMe from "@/components/StayWithMe";
import { useSafetyCheck, useSafetyCheckSetting } from "@/hooks/use-safety-check";
import type { Contact } from "./Contacts";

const DURATIONS = [30, 60, 120, 240];
const CHECK_IN = [15, 30, 60, 120];
type Kind = "walk" | "ride" | "meeting";
const KINDS: Array<{ id: Kind; icon: typeof Car }> = [
  { id: "walk", icon: Footprints },
  { id: "ride", icon: Car },
  { id: "meeting", icon: Users },
];
const VEHICLES = ["Cab", "Auto", "Bike taxi", "Bus"];

// "Walk with me": live location for confirmed contacts on a journey, without an alert.
const Walk = () => {
  const online = useOnline();
  const { t, tn } = useI18n();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [share, setShare] = useState<LiveShare | null>(null);
  const checkSetting = useSafetyCheckSetting();
  const check = useSafetyCheck(Boolean(share) && checkSetting.on);
  const [loaded, setLoaded] = useState(false);
  const [confirmed, setConfirmed] = useState<number | null>(null);
  const [minutes, setMinutes] = useState(60);
  const [note, setNote] = useState("");
  const [kind, setKind] = useState<Kind>(() => (new URLSearchParams(window.location.search).get("type") === "ride" ? "ride" : "walk"));
  const [details, setDetails] = useState({ vehicle: "", vehicleType: "Cab", app: "", driver: "", destination: "", person: "", place: "", profile: "" });
  const [checkIn, setCheckIn] = useState(60);
  const [checkInDue, setCheckInDue] = useState<string | null>(null);
  const detail = (key: keyof typeof details) => (e: React.ChangeEvent<HTMLInputElement>) => setDetails((d) => ({ ...d, [key]: e.target.value }));
  const [busy, setBusy] = useState(false);
  const [manualLink, setManualLink] = useState<string | null>(null);
  const places = usePlaces();
  const [destination, setDestination] = useState<SavedPlace | null>(null);

  // Opened from a regular-journey reminder (?routine=id): fill in its kind, place and name.
  const [params, setParams] = useSearchParams();
  const routineId = params.get("routine");
  useEffect(() => {
    if (!routineId) return;
    const routine = readRoutines().find((r) => r.id === routineId);
    if (routine) {
      setKind(routine.kind);
      setNote(routine.label);
      setDestination(places.find((p) => p.id === routine.placeId) ?? null);
    }
    setParams({}, { replace: true });
  }, [routineId, places, setParams]);

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
      const journey = kind !== "walk";
      // Meetings aren't journeys to a place of her own.
      const going = kind !== "meeting" ? destination : null;
      const res = await api<{ share: LiveShare & { url: string }; checkIn: { dueAt: string } | null; sent: number; total: number }>("/api/location-shares", {
        body: {
          kind,
          minutes: journey ? checkIn : minutes,
          note: note.trim() || undefined,
          coords,
          details: Object.fromEntries(
            Object.entries({ ...details, destination: details.destination || going?.label || "" }).map(([k, v]) => [k, v.trim() || undefined])
          ),
          checkInMinutes: journey ? checkIn : undefined,
          destination: going?.label,
        },
      });
      journeyDestination.set(res.share.id, going);
      setShare({ ...res.share, acks: [] });
      setCheckInDue(res.checkIn?.dueAt ?? null);
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
          <LiveLocation share={share} onEnded={ended} onFix={check.onFix} onOffRoute={() => check.clue("off_route")} />
          <SafetyCheckToggle on={checkSetting.on} setOn={checkSetting.setOn} />
          {checkSetting.on && <MicClues onClue={check.clue} />}
          <StayWithMe name={user?.name.split(" ")[0] ?? ""} />
          <SafetyCheckPrompt check={check} />
          {checkInDue && (
            <p className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
              <Timer className="h-4 w-4 shrink-0 text-primary" />
              {t("journey.checkInBy", { time: new Date(checkInDue).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) })}
            </p>
          )}
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
      <div className="space-y-6">
        <RoutineReminder />
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
            <div role="tablist" aria-label={t("journey.type")} className="grid grid-cols-3 gap-1 rounded-xl border bg-muted/50 p-1">
              {KINDS.map(({ id, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={kind === id}
                  onClick={() => setKind(id)}
                  className={`flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-xs font-semibold transition-colors sm:flex-row sm:justify-center sm:text-sm ${
                    kind === id ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" /> {t(`journey.${id}` as "journey.walk")}
                </button>
              ))}
            </div>

            {kind === "walk" && (
              <>
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
              </>
            )}

            {kind === "ride" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="ride-vehicle">{t("journey.vehicle")}</Label>
                  <Input id="ride-vehicle" value={details.vehicle} maxLength={20} placeholder="DL 01 AB 1234" className="uppercase" onChange={detail("vehicle")} />
                </div>
                <fieldset className="space-y-1">
                  <legend className="text-sm font-medium">{t("journey.vehicleType")}</legend>
                  <div className="flex flex-wrap gap-1.5">
                    {VEHICLES.map((v) => (
                      <Button key={v} type="button" size="sm" variant={details.vehicleType === v ? "hero" : "outline"} aria-pressed={details.vehicleType === v} onClick={() => setDetails((d) => ({ ...d, vehicleType: v }))}>
                        {t(`journey.vehicle.${v.replace(" ", "")}` as "journey.vehicle.Cab")}
                      </Button>
                    ))}
                  </div>
                </fieldset>
                <div className="space-y-1">
                  <Label htmlFor="ride-app">{t("journey.app")}</Label>
                  <Input id="ride-app" value={details.app} maxLength={40} placeholder="Uber, Ola, Rapido..." onChange={detail("app")} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ride-driver">{t("journey.driver")}</Label>
                  <Input id="ride-driver" value={details.driver} maxLength={60} onChange={detail("driver")} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="ride-destination">{t("journey.destination")}</Label>
                  <Input id="ride-destination" value={details.destination} maxLength={80} onChange={detail("destination")} />
                </div>
              </div>
            )}

            {kind === "meeting" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="meet-person">{t("journey.person")}</Label>
                  <Input id="meet-person" value={details.person} maxLength={60} onChange={detail("person")} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="meet-place">{t("journey.place")}</Label>
                  <Input id="meet-place" value={details.place} maxLength={80} onChange={detail("place")} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="meet-profile">{t("journey.profile")}</Label>
                  <Input id="meet-profile" value={details.profile} maxLength={80} placeholder={t("journey.profilePlaceholder")} onChange={detail("profile")} />
                </div>
              </div>
            )}

            {kind !== "meeting" && (
              <fieldset className="space-y-2">
                <legend className="mb-1 flex items-center gap-2 text-sm font-semibold">
                  <MapPin className="h-4 w-4 text-primary" /> {t("places.goingTo")}
                </legend>
                <div className="flex flex-wrap gap-1.5">
                  <Button type="button" size="sm" variant={!destination ? "hero" : "outline"} aria-pressed={!destination} onClick={() => setDestination(null)}>
                    {t("places.nowhere")}
                  </Button>
                  {places.map((p) => (
                    <Button key={p.id} type="button" size="sm" variant={destination?.id === p.id ? "hero" : "outline"} aria-pressed={destination?.id === p.id} onClick={() => setDestination(p)}>
                      {p.label}
                    </Button>
                  ))}
                  {/* A place found by search shows as its own chosen chip. */}
                  {destination && !places.some((p) => p.id === destination.id) && (
                    <Button type="button" size="sm" variant="hero" aria-pressed>
                      {destination.label}
                    </Button>
                  )}
                </div>
                <DestinationSearch onPick={setDestination} />
                {places.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {t("places.noneYet")}{" "}
                    <Link to="/account#places" className="font-semibold text-primary underline underline-offset-2">
                      {t("places.addOne")}
                    </Link>
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">{t("places.arriveHint")}</p>
                )}
                {destination && <TripCheck key={destination.id} to={destination} />}
              </fieldset>
            )}

            {kind !== "walk" && (
              <fieldset className="space-y-2">
                <legend className="mb-1 flex items-center gap-2 text-sm font-semibold">
                  <Timer className="h-4 w-4 text-primary" /> {t("journey.checkIn")}
                </legend>
                <p className="text-xs text-muted-foreground">{t("journey.checkInHint")}</p>
                <div className="grid grid-cols-4 gap-2">
                  {CHECK_IN.map((m) => (
                    <Button key={m} type="button" variant={checkIn === m ? "hero" : "outline"} aria-pressed={checkIn === m} onClick={() => setCheckIn(m)}>
                      {m >= 60 ? t("timer.hoursShort", { count: m / 60 }) : t("timer.minutesShort", { count: m })}
                    </Button>
                  ))}
                </div>
              </fieldset>
            )}
            <SafetyCheckToggle on={checkSetting.on} setOn={checkSetting.setOn} />
            <Button variant="hero" size="lg" className="w-full gap-2" onClick={start} disabled={busy || !online || confirmed === 0 || (kind === "ride" && !details.vehicle.trim()) || (kind === "meeting" && !details.person.trim())}>
              <Footprints className="h-5 w-5" /> {busy ? t("walk.starting") : t("walk.start")}
            </Button>
          </CardContent>
        </Card>
        <RoutinesManager />
      </div>
    );
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="px-4 pb-16 pt-24">
        <div className="container mx-auto max-w-xl space-y-4">
          <PageHeader icon={Footprints} title={t("walk.title")} subtitle={t("walk.intro")} />
          <NeedsInternet message="offline.walk" />
          {body()}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Walk;
