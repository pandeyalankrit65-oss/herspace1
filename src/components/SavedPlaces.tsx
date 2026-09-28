import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Crosshair, MapPin, Plus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n";
import { currentPosition } from "@/lib/location";
import { MAX_PLACES, savePlaces, usePlaces } from "@/lib/places";

type Point = { lat: number; lng: number };
// Middle of India, zoomed out, when we don't know where she is.
const FALLBACK: Point = { lat: 22.5, lng: 79 };
const SUGGESTIONS = ["places.home", "places.work", "places.college"] as const;

// Tapping the map moves the pin.
const PickOnMap = ({ onPick }: { onPick: (p: Point) => void }) => {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
};

const CenterOn = ({ point, zoom }: { point: Point; zoom: number }) => {
  const map = useMap();
  useEffect(() => {
    map.setView([point.lat, point.lng], zoom);
  }, [map, point, zoom]);
  return null;
};

// Home, work and other places a journey can head to. Kept only on this phone.
const SavedPlaces = () => {
  const { t } = useI18n();
  const places = usePlaces();
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [pin, setPin] = useState<Point | null>(null);
  const [center, setCenter] = useState<{ point: Point; zoom: number }>({ point: FALLBACK, zoom: 4 });
  const [locating, setLocating] = useState(false);

  const locate = async () => {
    setLocating(true);
    const pos = await currentPosition();
    setLocating(false);
    if (!pos) return;
    const point = { lat: pos.lat, lng: pos.lng };
    setPin(point);
    setCenter({ point, zoom: 17 });
  };

  const startAdding = () => {
    setAdding(true);
    setLabel(places.length === 0 ? t("places.home") : "");
    setPin(null);
    locate();
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin || !label.trim()) return;
    savePlaces([...places, { id: crypto.randomUUID(), label: label.trim(), lat: pin.lat, lng: pin.lng }]);
    setAdding(false);
  };

  return (
    <Card id="places">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" /> {t("places.title")}
        </CardTitle>
        <CardDescription>{t("places.desc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {places.length > 0 && (
          <ul className="divide-y rounded-xl border">
            {places.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="flex min-w-0 items-center gap-2 font-medium">
                  <MapPin className="h-4 w-4 shrink-0 text-primary" />
                  <span className="truncate">{p.label}</span>
                </span>
                <Button variant="ghost" size="sm" aria-label={t("places.remove", { name: p.label })} onClick={() => savePlaces(places.filter((x) => x.id !== p.id))}>
                  {t("common.delete")}
                </Button>
              </li>
            ))}
          </ul>
        )}

        {adding ? (
          <form className="space-y-3 rounded-xl border p-3" onSubmit={save}>
            <div className="space-y-1">
              <Label htmlFor="place-label">{t("places.name")}</Label>
              <Input id="place-label" value={label} maxLength={40} onChange={(e) => setLabel(e.target.value)} />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {SUGGESTIONS.map((key) => (
                  <Button key={key} type="button" size="sm" variant="outline" onClick={() => setLabel(t(key))}>
                    {t(key)}
                  </Button>
                ))}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{t("places.pickHint")}</p>
            <div className="relative z-0 h-64 overflow-hidden rounded-lg border" data-testid="place-map">
              <MapContainer center={[center.point.lat, center.point.lng]} zoom={center.zoom} className="h-full w-full">
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  crossOrigin="anonymous"
                />
                <CenterOn point={center.point} zoom={center.zoom} />
                <PickOnMap onPick={setPin} />
                {pin && <CircleMarker center={[pin.lat, pin.lng]} radius={10} pathOptions={{ color: "#fff", weight: 3, fillColor: "#db2777", fillOpacity: 1 }} />}
              </MapContainer>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" className="gap-2" onClick={locate} disabled={locating}>
                <Crosshair className="h-4 w-4" /> {locating ? t("places.locating") : t("places.useHere")}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button type="submit" variant="hero" disabled={!pin || !label.trim()}>
                {t("places.save")}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
                {t("common.cancel")}
              </Button>
            </div>
          </form>
        ) : (
          places.length < MAX_PLACES && (
            <Button variant="outline" className="gap-2" onClick={startAdding}>
              <Plus className="h-4 w-4" /> {t("places.add")}
            </Button>
          )
        )}
      </CardContent>
    </Card>
  );
};

export default SavedPlaces;
