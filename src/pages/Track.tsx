import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { MapContainer, TileLayer, CircleMarker, Circle, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { BatteryCharging, BatteryLow, BatteryMedium, CheckCircle2, Footprints, HeartPulse, Phone, ShieldCheck } from "lucide-react";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api, ApiError, EMERGENCY_NUMBER } from "@/lib/api";
import { useI18n } from "@/i18n";
import type { EmergencyInfo } from "@/components/EmergencyInfoSettings";

type Position = { lat: number; lng: number; accuracy: number | null; updatedAt: string };
type TrackView = {
  name: string;
  kind: "sos" | "walk" | "ride" | "meeting";
  note: string | null;
  active: boolean;
  acked: boolean;
  endedAt: string | null;
  expiresAt: string;
  position: Position | null;
  battery: { level: number; charging: boolean } | null;
  emergencyInfo: EmergencyInfo | null;
};

const POLL_MS = 15_000;
const LOW_BATTERY = 0.15;
const STALE_MS = 2 * 60_000;

// Keeps the map centred on the latest position.
const Follow = ({ position }: { position: Position }) => {
  const map = useMap();
  useEffect(() => {
    map.setView([position.lat, position.lng], Math.max(map.getZoom(), 15));
  }, [map, position.lat, position.lng]);
  return null;
};

function ago(iso: string, now: number, tn: (key: string, count: number) => string) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  return s < 60 ? tn("track.secondsAgo", s) : tn("track.minutesAgo", Math.round(s / 60));
}

// "Phone battery: 8%": if updates stop, contacts can tell the phone probably died.
const BatteryLine = ({ battery }: { battery: { level: number; charging: boolean } }) => {
  const { t } = useI18n();
  const percent = Math.round(battery.level * 100);
  const low = !battery.charging && battery.level <= LOW_BATTERY;
  const Icon = battery.charging ? BatteryCharging : low ? BatteryLow : BatteryMedium;
  return (
    <span className={`mt-0.5 flex items-center gap-1.5 ${low ? "font-semibold text-destructive" : ""}`}>
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      {t(battery.charging ? "track.batteryCharging" : "track.battery", { percent })}
      {low && ` · ${t("track.batteryLow")}`}
    </span>
  );
};

// Health details she chose to share, for paramedics or whoever reaches her first.
const EmergencyInfoCard = ({ info, name }: { info: EmergencyInfo; name: string }) => {
  const { t } = useI18n();
  const rows = [
    ["medical.bloodGroup", info.bloodGroup],
    ["medical.allergies", info.allergies],
    ["medical.medications", info.medications],
    ["medical.conditions", info.conditions],
    ["medical.notes", info.notes],
  ] as const;
  return (
    <Card className="border-destructive/40">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <HeartPulse className="h-5 w-5 text-destructive" /> {t("track.medicalTitle", { name })}
        </CardTitle>
        <CardDescription>{t("track.medicalDesc")}</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
          {rows
            .filter(([, value]) => value)
            .map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="font-semibold">{t(label)}</dt>
                <dd className="whitespace-pre-wrap text-muted-foreground sm:text-foreground">{value}</dd>
              </div>
            ))}
        </dl>
      </CardContent>
    </Card>
  );
};

// Opened by an emergency contact from the SOS text message. No account needed.
const Track = () => {
  const { token = "" } = useParams();
  // Personal code from the contact's own link, so their response says who they are.
  const [params] = useSearchParams();
  const code = params.get("c") ?? "";
  const { t, tn } = useI18n();
  const [acking, setAcking] = useState(false);
  const [view, setView] = useState<TrackView | null>(null);
  const [error, setError] = useState<"" | "track.invalid" | "track.retrying">("");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let stopped = false;
    const load = () =>
      api<TrackView>(`/api/track/${encodeURIComponent(token)}${code ? `?c=${encodeURIComponent(code)}` : ""}`)
        .then((v) => {
          if (stopped) return;
          setView(v);
          setError("");
          if (!v.active) stopped = true;
        })
        .catch((err) => {
          if (err instanceof ApiError && err.status === 404) {
            setError("track.invalid");
            stopped = true;
          } else setError("track.retrying");
        });
    load();
    const poll = setInterval(() => !stopped && load(), POLL_MS);
    const tick = setInterval(() => setNow(Date.now()), 5000);
    return () => {
      stopped = true;
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [token, code]);

  const acknowledge = async () => {
    setAcking(true);
    try {
      await api(`/api/track/${encodeURIComponent(token)}/ack`, { body: { c: code } });
      setView((v) => (v ? { ...v, acked: true } : v));
    } catch {
      // The button stays available to try again.
    } finally {
      setAcking(false);
    }
  };

  const stale = view?.position && now - new Date(view.position.updatedAt).getTime() > STALE_MS;

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-3xl space-y-4">
          {!view && !error && <p className="text-muted-foreground">{t("common.loading")}</p>}
          {error && !view && (
            <Card>
              <CardHeader>
                <CardTitle>{t("track.unavailableTitle")}</CardTitle>
                <CardDescription>{t(error)}</CardDescription>
              </CardHeader>
            </Card>
          )}

          {view && !view.active && (
            <Card className="border-green-500/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-6 w-6 text-green-500" />
                  {view.kind !== "sos"
                    ? t("track.walkEndedTitle", { name: view.name })
                    : view.endedAt
                      ? t("track.safeTitle", { name: view.name })
                      : t("track.endedTitle")}
                </CardTitle>
                <CardDescription>
                  {view.endedAt
                    ? t(view.kind !== "sos" ? "track.walkEndedDesc" : "track.safeDesc", { time: new Date(view.endedAt).toLocaleString() })
                    : t("track.expiredDesc")}{" "}
                  {view.kind === "sos" && t("track.stillWorried")}
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          {view?.active && (
            <>
              <div className="space-y-2">
                {view.kind !== "sos" ? (
                  <>
                    <h1 className="flex items-center gap-2 text-3xl font-extrabold">
                      <Footprints className="h-7 w-7 text-primary" />
                      {t(view.kind === "ride" ? "track.rideTitle" : view.kind === "meeting" ? "track.meetingTitle" : "track.walkTitle", { name: view.name })}
                    </h1>
                    <p className="text-muted-foreground">{t("track.walkIntro", { name: view.name })}</p>
                  </>
                ) : (
                  <>
                    <h1 className="text-3xl font-extrabold text-destructive">{t("track.needsHelp", { name: view.name })}</h1>
                    <p className="text-muted-foreground">{t("track.intro", { name: view.name })}</p>
                  </>
                )}
                {view.note && <p className="font-semibold">"{view.note}"</p>}
              </div>

              {/* Tell them someone is responding: very reassuring in an emergency. */}
              {view.acked ? (
                <p role="status" className="flex items-center gap-2 rounded-xl border border-success/40 bg-success/10 p-3 text-sm font-semibold">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
                  {t(view.kind !== "sos" ? "track.followingThanks" : "track.ackThanks", { name: view.name })}
                </p>
              ) : (
                <Button
                  variant={view.kind !== "sos" ? "glass" : "hero"}
                  size="lg"
                  className="w-full gap-2"
                  onClick={acknowledge}
                  disabled={acking}
                >
                  <CheckCircle2 className="h-5 w-5" />
                  {t(view.kind !== "sos" ? "track.following" : "track.onMyWay")}
                </Button>
              )}

              {error && <p className="text-sm text-destructive">{t(error)}</p>}
              {view.position ? (
                <Card className="overflow-hidden">
                  <CardContent className="p-0">
                    <div className={`px-4 py-2 text-sm ${stale ? "bg-destructive/15 text-foreground" : "text-muted-foreground"}`}>
                      {t("track.updated", { ago: ago(view.position.updatedAt, now, tn) })}
                      {view.position.accuracy ? ` · ${t("track.accuracy", { meters: Math.round(view.position.accuracy) })}` : ""}
                      {view.battery && <BatteryLine battery={view.battery} />}
                      {stale && <strong className="block">{t("track.stale")}</strong>}
                    </div>
                    <div className="relative z-0 h-[55vh] min-h-[320px]">
                      <MapContainer center={[view.position.lat, view.position.lng]} zoom={15} className="h-full w-full">
                        <TileLayer
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          crossOrigin="anonymous"
                        />
                        {view.position.accuracy && (
                          <Circle
                            center={[view.position.lat, view.position.lng]}
                            radius={view.position.accuracy}
                            pathOptions={{ color: "#dc2626", weight: 1, fillOpacity: 0.1 }}
                          />
                        )}
                        <CircleMarker
                          center={[view.position.lat, view.position.lng]}
                          radius={10}
                          pathOptions={{ color: "#fff", weight: 3, fillColor: "#dc2626", fillOpacity: 1 }}
                        />
                        <Follow position={view.position} />
                      </MapContainer>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>{t("track.waitingTitle")}</CardTitle>
                    <CardDescription>{t("track.waitingDesc")}</CardDescription>
                  </CardHeader>
                </Card>
              )}

              {view.emergencyInfo && <EmergencyInfoCard info={view.emergencyInfo} name={view.name} />}

              <div className="flex flex-col sm:flex-row gap-2">
                {view.position && (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${view.position.lat},${view.position.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1"
                  >
                    <Button variant="hero" className="w-full">
                      {t("track.directions")}
                    </Button>
                  </a>
                )}
                <a href={`tel:${EMERGENCY_NUMBER}`} className="flex-1">
                  <Button variant="emergency" className="w-full gap-2">
                    <Phone className="h-4 w-4" /> {t("common.call", { number: EMERGENCY_NUMBER })}
                  </Button>
                </a>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("track.footer", {
                  name: view.name,
                  time: new Date(view.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                })}
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default Track;
