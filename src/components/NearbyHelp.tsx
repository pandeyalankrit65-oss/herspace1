import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { Marker, Popup } from "react-leaflet";
import { useI18n } from "@/i18n";
import type { MessageKey } from "@/i18n/en";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

export type PlaceType = "police" | "hospital" | "pharmacy";
type Place = { id: string; type: PlaceType; name: string | null; lat: number; lng: number; phone: string | null; openingHours: string | null };
type NearbyResponse = { available: boolean; radius: number; places: Place[] };

const PLACE_STYLES: Record<PlaceType, { label: MessageKey; color: string; glyph: string }> = {
  police: { label: "map.police", color: "#2563eb", glyph: "P" },
  hospital: { label: "map.hospital", color: "#dc2626", glyph: "H" },
  pharmacy: { label: "map.pharmacy", color: "#059669", glyph: "+" },
};

// Square badges, so help locations are never confused with the round incident dots.
const icons = Object.fromEntries(
  Object.entries(PLACE_STYLES).map(([type, { color, glyph }]) => [
    type,
    L.divIcon({
      className: "",
      html: `<span style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:8px;background:${color};color:#fff;font:800 14px/1 system-ui;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)">${glyph}</span>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
      popupAnchor: [0, -14],
    }),
  ])
) as Record<PlaceType, L.DivIcon>;

export type NearbyState = { status: "idle" | "loading" | "ready" | "unavailable"; counts: Record<PlaceType, number> };

// Fetches police stations, hospitals and pharmacies around `center` and draws them on the map.
export function useNearby(center: [number, number] | null) {
  const [places, setPlaces] = useState<Place[]>([]);
  const [status, setStatus] = useState<NearbyState["status"]>("idle");

  useEffect(() => {
    if (!center) return;
    let cancelled = false;
    setStatus("loading");
    api<NearbyResponse>(`/api/nearby?lat=${center[0]}&lng=${center[1]}`)
      .then((res) => {
        if (cancelled) return;
        setPlaces(res.places);
        setStatus(res.available ? "ready" : "unavailable");
      })
      .catch(() => !cancelled && setStatus("unavailable"));
    return () => {
      cancelled = true;
    };
  }, [center]);

  const counts = useMemo(() => {
    const c: Record<PlaceType, number> = { police: 0, hospital: 0, pharmacy: 0 };
    for (const p of places) c[p.type]++;
    return c;
  }, [places]);

  return { places, status, counts };
}

export const NearbyMarkers = ({ places, visible }: { places: Place[]; visible: Record<PlaceType, boolean> }) => {
  const { t } = useI18n();
  return (
    <>
      {places
        .filter((p) => visible[p.type])
        .map((p) => (
          <Marker key={p.id} position={[p.lat, p.lng]} icon={icons[p.type]}>
            <Popup>
              <strong>{p.name || t("map.unnamed")}</strong>
              <br />
              <span style={{ fontSize: 12, opacity: 0.75 }}>{t(PLACE_STYLES[p.type].label)}</span>
              {p.openingHours && (
                <>
                  <br />
                  <span style={{ fontSize: 12 }}>{p.openingHours}</span>
                </>
              )}
              <br />
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`} target="_blank" rel="noreferrer">
                {t("map.directions")}
              </a>
              {p.phone && (
                <>
                  {" · "}
                  <a href={`tel:${p.phone.split(";")[0].replace(/\s/g, "")}`}>{t("map.callPlace")}</a>
                </>
              )}
            </Popup>
          </Marker>
        ))}
    </>
  );
};

// Straight-line distance in metres.
const distance = (a: [number, number], b: [number, number]) => {
  const rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad;
  const dLng = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
};

// The closest police station, hospital or pharmacy, with walking directions: somewhere to
// head for when you're being followed or need help now.
export const NearestHelp = ({ places, me }: { places: Place[]; me: [number, number] | null }) => {
  const { t } = useI18n();
  if (!me || places.length === 0) return null;
  const nearest = places.reduce((best, p) => (distance(me, [p.lat, p.lng]) < distance(me, [best.lat, best.lng]) ? p : best));
  const metres = distance(me, [nearest.lat, nearest.lng]);
  const style = PLACE_STYLES[nearest.type];
  return (
    <div className="flex flex-wrap items-center gap-3 border-b bg-success/10 px-4 py-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-extrabold text-white" style={{ background: style.color }} aria-hidden>
        {style.glyph}
      </span>
      <p className="min-w-0 flex-1 text-sm">
        <span className="font-semibold">{t("map.nearestLabel")}</span> {nearest.name || t("map.unnamed")} · {t(style.label)} ·{" "}
        {metres < 1000 ? t("map.metres", { n: Math.round(metres / 10) * 10 }) : t("map.km", { n: (metres / 1000).toFixed(1) })}
      </p>
      <a
        href={`https://www.google.com/maps/dir/?api=1&destination=${nearest.lat},${nearest.lng}&travelmode=walking`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground"
      >
        {t("map.walkThere")}
      </a>
    </div>
  );
};

export const NearbyFilters = ({
  state,
  visible,
  onToggle,
}: {
  state: NearbyState;
  visible: Record<PlaceType, boolean>;
  onToggle: (type: PlaceType) => void;
}) => {
  const { t } = useI18n();
  return (
    <div className="space-y-2 border-b px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm font-bold">{t("map.nearbyTitle")}</span>
        {(Object.keys(PLACE_STYLES) as PlaceType[]).map((type) => {
          const { label, color, glyph } = PLACE_STYLES[type];
          return (
            <button
              key={type}
              type="button"
              aria-pressed={visible[type]}
              onClick={() => onToggle(type)}
              disabled={state.status !== "ready"}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-50",
                visible[type] ? "bg-card" : "bg-muted text-muted-foreground line-through"
              )}
            >
              <span className="flex h-4 w-4 items-center justify-center rounded text-[10px] font-extrabold text-white" style={{ background: color }}>
                {glyph}
              </span>
              {t(label)}
              {state.status === "ready" && <span className="text-muted-foreground">{state.counts[type]}</span>}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {state.status === "idle"
          ? t("map.nearbyHint")
          : state.status === "loading"
            ? t("map.nearbyLoading")
            : state.status === "unavailable"
              ? t("map.nearbyUnavailable")
              : state.counts.police + state.counts.hospital + state.counts.pharmacy === 0
                ? t("map.noNearby")
                : t("map.nearbySource")}
      </p>
    </div>
  );
};
