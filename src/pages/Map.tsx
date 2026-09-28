import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { LocateFixed, Info, MapPin } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { api } from "@/lib/api";
import { savedData } from "@/lib/offline";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import type { MessageKey } from "@/i18n/en";
import PageHeader from "@/components/PageHeader";
import { NearbyFilters, NearbyMarkers, NearestHelp, useNearby, type PlaceType } from "@/components/NearbyHelp";

type Point = { id: number; incidentType: string; lat: number; lng: number; date: string };

const TYPE_STYLES: Record<string, { label: MessageKey; color: string }> = {
  harassment: { label: "report.types.harassment", color: "#e11d48" },
  assault: { label: "report.types.assault", color: "#b91c1c" },
  stalking: { label: "report.types.stalking", color: "#d97706" },
  threat: { label: "report.types.threat", color: "#7c3aed" },
  discrimination: { label: "report.types.discrimination", color: "#0891b2" },
  other: { label: "report.types.other", color: "#64748b" },
};

const DEFAULT_CENTER: [number, number] = [20.59, 78.96];

// Moves the map when the target changes (MapContainer's center prop is only read once).
const FlyTo = ({ target }: { target: [number, number] | null }) => {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target, 14);
  }, [map, target]);
  return null;
};

const Map = () => {
  const [points, setPoints] = useState<Point[]>([]);
  const [error, setError] = useState("");
  const [me, setMe] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState("");
  const [flagged, setFlagged] = useState<Set<number>>(new Set());
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const nearby = useNearby(me);
  const [visible, setVisible] = useState<Record<PlaceType, boolean>>({ police: true, hospital: true, pharmacy: true });
  const { toast } = useToast();
  const { t, tn } = useI18n();

  const flag = async (id: number) => {
    try {
      await api(`/api/reports/${id}/flag`, { method: "POST" });
      setFlagged((prev) => new Set(prev).add(id));
      toast({ title: t("map.flagToastTitle"), description: t("map.flagToastDesc") });
    } catch (err) {
      toast({ title: t("map.flagFailed"), description: (err as Error).message, variant: "destructive" });
    }
  };

  useEffect(() => {
    api<{ points: Point[] }>("/api/reports/map")
      .then((res) => {
        setPoints(res.points);
        savedData.set("map", res.points);
      })
      .catch((err) => {
        // Offline: show the incidents from the last visit, and say how old they are.
        const saved = savedData.get<Point[]>("map");
        if (saved) {
          setPoints(saved.data);
          setSavedAt(saved.at);
        } else setError(err.message);
      });
  }, []);

  const locate = () => {
    if (!navigator.geolocation) {
      setLocateError(t("map.noGeo"));
      return;
    }
    setLocating(true);
    setLocateError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMe([pos.coords.latitude, pos.coords.longitude]);
        setLocating(false);
      },
      () => {
        setLocateError(t("map.denied"));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const center = useMemo<[number, number]>(() => (points.length ? [points[0].lat, points[0].lng] : DEFAULT_CENTER), [points]);

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <PageHeader icon={MapPin} title={t("map.title")} subtitle={t("map.intro")} />

          <Card className="mb-6 overflow-hidden">
            <CardContent className="p-0">
              <NearbyFilters state={nearby} visible={visible} onToggle={(type) => setVisible((v) => ({ ...v, [type]: !v[type] }))} />
              <NearestHelp places={nearby.places} me={me} />
              {savedAt && (
                <p role="status" className="border-b bg-warning/10 px-4 py-2 text-sm">
                  {t("offline.mapSaved", { date: new Date(savedAt).toLocaleString() })}
                </p>
              )}
              {(error || locateError) && (
                <p className="px-4 py-2 text-sm text-destructive">{error ? t("map.loadFailed", { error }) : locateError}</p>
              )}
              {/* z-0 keeps Leaflet's panes below the fixed navbar */}
              <div className="relative z-0 h-[58vh] min-h-[340px]">
                {/* Above Leaflet's panes (z 400) and below its controls (z 800). */}
                <Button
                  variant="hero"
                  size="sm"
                  onClick={locate}
                  disabled={locating}
                  className="absolute right-3 top-3 z-[500] gap-2 shadow-raised"
                >
                  <LocateFixed className="h-4 w-4" />
                  {locating ? t("map.locating") : t("map.showLocation")}
                </Button>
                <MapContainer
                  center={center}
                  zoom={points.length ? 11 : 5}
                  className="h-full w-full"
                  key={points.length ? "data" : "empty"}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    crossOrigin="anonymous"
                  />
                  {points.map((p) => {
                    const style = TYPE_STYLES[p.incidentType] ?? TYPE_STYLES.other;
                    return (
                      <CircleMarker
                        key={p.id}
                        center={[p.lat, p.lng]}
                        radius={9}
                        pathOptions={{ color: style.color, fillColor: style.color, fillOpacity: 0.45, weight: 2 }}
                      >
                        <Popup>
                          <strong>{t(style.label)}</strong>
                          <br />
                          {new Date(p.date).toLocaleDateString()}
                          <br />
                          <span style={{ fontSize: 11, opacity: 0.7 }}>{t("map.approx")}</span>
                          <br />
                          {flagged.has(p.id) ? (
                            <span style={{ fontSize: 11 }}>{t("map.flagged")}</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => flag(p.id)}
                              style={{ fontSize: 11, textDecoration: "underline", marginTop: 4 }}
                            >
                              {t("map.flag")}
                            </button>
                          )}
                        </Popup>
                      </CircleMarker>
                    );
                  })}
                  {me && (
                    <CircleMarker
                      center={me}
                      radius={8}
                      pathOptions={{ color: "#2563eb", fillColor: "#3b82f6", fillOpacity: 0.9 }}
                    >
                      <Popup>{t("map.youAreHere")}</Popup>
                    </CircleMarker>
                  )}
                  <NearbyMarkers places={nearby.places} visible={visible} />
                  <FlyTo target={me} />
                </MapContainer>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t px-4 py-3">
                <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs" aria-label={t("map.legend")}>
                  {Object.entries(TYPE_STYLES).map(([key, { label, color }]) => (
                    <li key={key} className="flex items-center gap-1.5">
                      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                      {t(label)}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">{tn("map.count", points.length)}</p>
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <Info className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">{t("map.privacyTitle")}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{t("map.privacyDesc")}</CardDescription>
              </CardContent>
            </Card>

            <Card className="bg-primary/5 border-primary/20">
              <CardHeader>
                <CardTitle className="text-lg">{t("map.helpTitle")}</CardTitle>
                <CardDescription>{t("map.helpDesc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <Link to="/report">
                  <Button variant="hero">{t("map.reportButton")}</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Map;
