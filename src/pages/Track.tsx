import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { MapContainer, TileLayer, CircleMarker, Circle, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Phone, ShieldCheck } from "lucide-react";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api, ApiError, EMERGENCY_NUMBER } from "@/lib/api";

type Position = { lat: number; lng: number; accuracy: number | null; updatedAt: string };
type TrackView = { name: string; active: boolean; endedAt: string | null; expiresAt: string; position: Position | null };

const POLL_MS = 15_000;
const STALE_MS = 2 * 60_000;

// Keeps the map centred on the latest position.
const Follow = ({ position }: { position: Position }) => {
  const map = useMap();
  useEffect(() => {
    map.setView([position.lat, position.lng], Math.max(map.getZoom(), 15));
  }, [map, position.lat, position.lng]);
  return null;
};

function ago(iso: string, now: number) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s} seconds ago`;
  const m = Math.round(s / 60);
  return m === 1 ? "1 minute ago" : `${m} minutes ago`;
}

// Opened by an emergency contact from the SOS text message. No account needed.
const Track = () => {
  const { token = "" } = useParams();
  const [view, setView] = useState<TrackView | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let stopped = false;
    const load = () =>
      api<TrackView>(`/api/track/${encodeURIComponent(token)}`)
        .then((v) => {
          if (stopped) return;
          setView(v);
          setError("");
          if (!v.active) stopped = true;
        })
        .catch((err) => {
          if (err instanceof ApiError && err.status === 404) {
            setError(err.message);
            stopped = true;
          } else setError("Can't reach HerSpace right now. Retrying...");
        });
    load();
    const poll = setInterval(() => !stopped && load(), POLL_MS);
    const tick = setInterval(() => setNow(Date.now()), 5000);
    return () => {
      stopped = true;
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [token]);

  const stale = view?.position && now - new Date(view.position.updatedAt).getTime() > STALE_MS;

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-3xl space-y-4">
          {!view && !error && <p className="text-muted-foreground">Loading...</p>}
          {error && !view && (
            <Card>
              <CardHeader>
                <CardTitle>Link not available</CardTitle>
                <CardDescription>{error}</CardDescription>
              </CardHeader>
            </Card>
          )}

          {view && !view.active && (
            <Card className="border-green-500/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-6 w-6 text-green-500" />
                  {view.endedAt ? `${view.name} has marked themselves safe` : "Location sharing has ended"}
                </CardTitle>
                <CardDescription>
                  {view.endedAt
                    ? `They stopped sharing their location at ${new Date(view.endedAt).toLocaleString()}.`
                    : "This live location link has expired."}{" "}
                  If you're still worried, call them.
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          {view?.active && (
            <>
              <div className="space-y-1">
                <h1 className="text-3xl font-bold text-destructive">{view.name} needs help</h1>
                <p className="text-muted-foreground">
                  {view.name} pressed SOS in HerSpace and is sharing their live location with you. Call them now. If you can't
                  reach them, call emergency services.
                </p>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}
              {view.position ? (
                <Card className="overflow-hidden">
                  <CardContent className="p-0">
                    <div className={`px-4 py-2 text-sm ${stale ? "bg-destructive/15 text-foreground" : "text-muted-foreground"}`}>
                      Updated {ago(view.position.updatedAt, now)}
                      {stale && ". This may be out of date: their phone may be locked or offline."}
                      {view.position.accuracy ? ` · accurate to about ${Math.round(view.position.accuracy)} m` : ""}
                    </div>
                    <div className="relative z-0 h-[55vh] min-h-[320px]">
                      <MapContainer center={[view.position.lat, view.position.lng]} zoom={15} className="h-full w-full">
                        <TileLayer
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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
                    <CardTitle>Waiting for their location</CardTitle>
                    <CardDescription>
                      Their phone hasn't shared a position yet. This page refreshes automatically.
                    </CardDescription>
                  </CardHeader>
                </Card>
              )}

              <div className="flex flex-col sm:flex-row gap-2">
                {view.position && (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${view.position.lat},${view.position.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1"
                  >
                    <Button variant="hero" className="w-full">Get directions</Button>
                  </a>
                )}
                <a href={`tel:${EMERGENCY_NUMBER}`} className="flex-1">
                  <Button variant="emergency" className="w-full gap-2">
                    <Phone className="h-4 w-4" /> Call {EMERGENCY_NUMBER}
                  </Button>
                </a>
              </div>
              <p className="text-xs text-muted-foreground">
                This page refreshes every 15 seconds. Sharing stops when {view.name} taps "I'm safe", or automatically at{" "}
                {new Date(view.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default Track;
