import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { savedData } from "@/lib/offline";

export type PlaceType = "police" | "hospital" | "pharmacy";
export type Place = { id: string; type: PlaceType; name: string | null; lat: number; lng: number; phone: string | null; openingHours: string | null };
type NearbyResponse = { available: boolean; radius: number; places: Place[] };

// Straight-line distance in metres.
export const distance = (a: [number, number], b: [number, number]) => {
  const rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad;
  const dLng = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
};

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
        if (res.available) savedData.set("nearby", { center, places: res.places });
      })
      .catch(() => {
        if (cancelled) return;
        // Offline: the last places found, if they were looked up near here.
        const saved = savedData.get<{ center: [number, number]; places: Place[] }>("nearby");
        if (saved && distance(saved.data.center, center) < 3000) {
          setPlaces(saved.data.places);
          setStatus("ready");
        } else setStatus("unavailable");
      });
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
