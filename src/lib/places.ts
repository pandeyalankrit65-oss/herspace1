import { useEffect, useState } from "react";

// Saved places ("Home", "Work") are kept only on this phone: a home address is exactly what
// someone dangerous would want, so it never goes to our server. Arrival is detected here too,
// from the positions the phone already has. Removed on logout (see clearOfflineData).

export type SavedPlace = { id: string; label: string; lat: number; lng: number };
type Point = { lat: number; lng: number };

export const PLACES_KEY = "herspace_places";
export const JOURNEY_KEY = "herspace_journey_destination";
export const MAX_PLACES = 10;
const CHANGED = "herspace-places-changed";

// Close enough to count as "there": about a street's length, and only with a reasonably
// precise fix (a 500 m guess could be anywhere in the neighbourhood).
export const ARRIVE_M = 150;
const MAX_ACCURACY_M = 200;

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked: places just won't be remembered.
  }
}

export const readPlaces = () => read<SavedPlace[]>(PLACES_KEY) ?? [];

export function savePlaces(places: SavedPlace[]) {
  write(PLACES_KEY, places.slice(0, MAX_PLACES));
  window.dispatchEvent(new Event(CHANGED));
}

export function usePlaces() {
  const [places, setPlaces] = useState(readPlaces);
  useEffect(() => {
    const sync = () => setPlaces(readPlaces());
    window.addEventListener(CHANGED, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGED, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return places;
}

// The place the current journey is heading to, so arrival still works after a reload.
export const journeyDestination = {
  get: (shareId: number) => {
    const saved = read<{ shareId: number; place: SavedPlace }>(JOURNEY_KEY);
    return saved?.shareId === shareId ? saved.place : null;
  },
  set: (shareId: number, place: SavedPlace | null) => write(JOURNEY_KEY, place ? { shareId, place } : null),
};

// Rough distance in metres; plenty accurate at city scale.
export function metresBetween(a: Point, b: Point) {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x = dLng * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  return Math.sqrt(x * x + dLat * dLat) * 6_371_000;
}

export const isAt = (pos: Point & { accuracy?: number | null }, place: Point) =>
  (pos.accuracy ?? 0) <= MAX_ACCURACY_M && metresBetween(pos, place) <= ARRIVE_M;
