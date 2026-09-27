import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { LocateFixed, Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

type Point = { id: number; incidentType: string; lat: number; lng: number; date: string };

const TYPE_STYLES: Record<string, { label: string; color: string }> = {
  harassment: { label: "Harassment", color: "#e11d48" },
  assault: { label: "Assault", color: "#b91c1c" },
  stalking: { label: "Stalking", color: "#d97706" },
  threat: { label: "Threat", color: "#7c3aed" },
  discrimination: { label: "Discrimination", color: "#0891b2" },
  other: { label: "Other", color: "#64748b" },
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
  const { toast } = useToast();

  const flag = async (id: number) => {
    try {
      await api(`/api/reports/${id}/flag`, { method: "POST" });
      setFlagged((prev) => new Set(prev).add(id));
      toast({ title: "Thanks for flagging", description: "Reports flagged by several people are hidden from the map." });
    } catch (err) {
      toast({ title: "Couldn't flag report", description: (err as Error).message, variant: "destructive" });
    }
  };

  useEffect(() => {
    api<{ points: Point[] }>("/api/reports/map")
      .then((res) => setPoints(res.points))
      .catch((err) => setError(err.message));
  }, []);

  const locate = () => {
    if (!navigator.geolocation) {
      setLocateError("Your browser doesn't support location.");
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
        setLocateError("Location permission was denied or unavailable.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const center = useMemo<[number, number]>(
    () => (points.length ? [points[0].lat, points[0].lng] : DEFAULT_CENTER),
    [points]
  );

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-8 space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold">
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Safe Map</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Incidents reported by the HerSpace community, so you can be aware of what's happened nearby.
            </p>
          </div>

          <Card className="mb-6 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50 overflow-hidden">
            <CardContent className="p-0">
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-border/50">
                <div className="flex flex-wrap gap-3 text-xs">
                  {Object.entries(TYPE_STYLES).map(([key, { label, color }]) => (
                    <span key={key} className="flex items-center gap-1.5">
                      <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
                      {label}
                    </span>
                  ))}
                </div>
                <Button variant="hero" size="sm" onClick={locate} disabled={locating} className="gap-2">
                  <LocateFixed className="h-4 w-4" />
                  {locating ? "Locating..." : "Show my location"}
                </Button>
              </div>
              {(error || locateError) && (
                <p className="px-4 py-2 text-sm text-destructive">{error ? `Couldn't load reports: ${error}` : locateError}</p>
              )}
              {/* z-0 keeps Leaflet's panes below the fixed navbar */}
              <div className="relative z-0 h-[60vh] min-h-[360px]">
                <MapContainer center={center} zoom={points.length ? 11 : 5} className="h-full w-full" key={points.length ? "data" : "empty"}>
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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
                          <strong>{style.label}</strong>
                          <br />
                          {new Date(p.date).toLocaleDateString()}
                          <br />
                          <span style={{ fontSize: 11, opacity: 0.7 }}>Approximate area (~1 km)</span>
                          <br />
                          {flagged.has(p.id) ? (
                            <span style={{ fontSize: 11 }}>Flagged. Thank you.</span>
                          ) : (
                            <button type="button" onClick={() => flag(p.id)} style={{ fontSize: 11, textDecoration: "underline", marginTop: 4 }}>
                              Flag as false or abusive
                            </button>
                          )}
                        </Popup>
                      </CircleMarker>
                    );
                  })}
                  {me && (
                    <CircleMarker center={me} radius={8} pathOptions={{ color: "#2563eb", fillColor: "#3b82f6", fillOpacity: 0.9 }}>
                      <Popup>You are here</Popup>
                    </CircleMarker>
                  )}
                  <FlyTo target={me} />
                </MapContainer>
              </div>
              <p className="px-4 py-3 text-xs text-muted-foreground">
                {points.length} reported incident{points.length === 1 ? "" : "s"} with a location. Absence of reports doesn't mean an area is safe.
              </p>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            <Card className="bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50">
              <CardHeader>
                <Info className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">How this map protects privacy</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Points are rounded to roughly 1 km and show only the incident type and date. Descriptions and the reporter's
                  identity are never shown on the map. Reports flagged as false by several people are hidden.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-primary/10 to-accent/10 border-primary/30">
              <CardHeader>
                <CardTitle className="text-lg">Help others stay aware</CardTitle>
                <CardDescription>
                  When you report an incident, you can choose to add your location to this map, anonymously if you prefer.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link to="/report">
                  <Button variant="hero">Report an incident</Button>
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
