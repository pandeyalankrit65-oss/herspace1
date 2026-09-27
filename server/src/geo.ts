// OpenStreetMap lookups made by the server (so users' devices don't contact third parties).
// Both are optional extras: they time out fast and fail silently, because an SOS must never
// wait on or fail because of them. Set NOMINATIM_URL / OVERPASS_URL to "off" to disable.

const USER_AGENT = `HerSpace/1.0 (${process.env.APP_URL || 'https://herspace.app'})`;
const nominatimBase = () => process.env.NOMINATIM_URL ?? 'https://nominatim.openstreetmap.org';
const overpassUrl = () => process.env.OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter';

// Small time-limited caches: public OSM services ask for low request rates.
function cache<T>(max: number, ttlMs: number) {
  const map = new Map<string, { at: number; value: T }>();
  return {
    get(key: string) {
      const hit = map.get(key);
      if (!hit || Date.now() - hit.at > ttlMs) return undefined;
      return hit.value;
    },
    set(key: string, value: T) {
      if (map.size >= max) map.delete(map.keys().next().value as string);
      map.set(key, { at: Date.now(), value });
    },
  };
}

type NominatimAddress = Partial<
  Record<'road' | 'neighbourhood' | 'suburb' | 'quarter' | 'city_district' | 'city' | 'town' | 'village' | 'county' | 'state', string>
>;

// "Near Connaught Place, New Delhi": the most specific area name plus the town or city.
export function formatAddress(address: NominatimAddress | undefined): string | null {
  if (!address) return null;
  const area = address.neighbourhood || address.suburb || address.quarter || address.city_district || address.road;
  const place = address.city || address.town || address.village || address.county || address.state;
  const parts = [area, place].filter((p, i, all) => p && all.indexOf(p) === i);
  return parts.length ? parts.join(', ') : null;
}

const addressCache = cache<string | null>(500, 24 * 60 * 60 * 1000);

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const base = nominatimBase();
  if (base === 'off') return null;
  // ~100 m precision is plenty for "near ..." and makes the cache useful.
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  const cached = addressCache.get(key);
  if (cached !== undefined) return cached;
  try {
    const url = `${base}/reverse?format=jsonv2&zoom=16&accept-language=en&lat=${lat.toFixed(4)}&lon=${lng.toFixed(4)}`;
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(2500) });
    if (!res.ok) return null;
    const data = (await res.json()) as { address?: NominatimAddress };
    const address = formatAddress(data.address);
    addressCache.set(key, address);
    return address;
  } catch {
    return null;
  }
}

export type NearbyPlace = {
  id: string;
  type: 'police' | 'hospital' | 'pharmacy';
  name: string | null;
  lat: number;
  lng: number;
  phone: string | null;
  openingHours: string | null;
};

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

export function parsePlaces(elements: OverpassElement[]): NearbyPlace[] {
  const places: NearbyPlace[] = [];
  for (const el of elements) {
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    const type = el.tags?.amenity;
    if (lat === undefined || lng === undefined || (type !== 'police' && type !== 'hospital' && type !== 'pharmacy')) continue;
    places.push({
      id: `${el.type}/${el.id}`,
      type,
      name: el.tags?.['name:en'] || el.tags?.name || null,
      lat,
      lng,
      phone: el.tags?.phone || el.tags?.['contact:phone'] || null,
      openingHours: el.tags?.opening_hours || null,
    });
  }
  return places;
}

const placesCache = cache<NearbyPlace[]>(300, 24 * 60 * 60 * 1000);
export const NEARBY_RADIUS_M = 3000;

export async function nearbyPlaces(lat: number, lng: number): Promise<NearbyPlace[] | null> {
  const url = overpassUrl();
  if (url === 'off') return null;
  // Rounded to ~1 km: protects the user's exact position and lets nearby users share the cache.
  const rLat = Number(lat.toFixed(2));
  const rLng = Number(lng.toFixed(2));
  const key = `${rLat},${rLng}`;
  const cached = placesCache.get(key);
  if (cached) return cached;
  const around = `around:${NEARBY_RADIUS_M},${rLat},${rLng}`;
  const query = `[out:json][timeout:10];(node[amenity~"^(police|hospital|pharmacy)$"](${around});way[amenity~"^(police|hospital)$"](${around}););out center 80;`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ data: query }),
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { elements?: OverpassElement[] };
    const places = parsePlaces(data.elements ?? []);
    placesCache.set(key, places);
    return places;
  } catch {
    return null;
  }
}
