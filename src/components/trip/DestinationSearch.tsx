import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import type { SavedPlace } from "@/lib/places";

type Found = { label: string; lat: number; lng: number };

// Find a destination by name (searched by our server, within India). A found place works like a
// saved one for the journey: contacts see where she's heading, and arrival is noticed.
const DestinationSearch = ({ onPick }: { onPick: (place: SavedPlace) => void }) => {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Found[] | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const res = await api<{ available: boolean; places: Found[] }>(`/api/places/search?q=${encodeURIComponent(q.trim())}`);
      setResults(res.places);
      if (!res.available) setMessage(t("trip.searchUnavailable"));
      else if (res.places.length === 0) setMessage(t("trip.noResults"));
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <form role="search" onSubmit={search} className="flex gap-2">
        <label htmlFor="trip-search" className="sr-only">
          {t("trip.search")}
        </label>
        <Input id="trip-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("trip.searchPlaceholder")} maxLength={100} />
        <Button type="submit" variant="outline" size="icon" disabled={busy || q.trim().length < 3} aria-label={t("trip.search")}>
          <Search className="h-4 w-4" />
        </Button>
      </form>
      {message && <p className="text-xs text-muted-foreground">{message}</p>}
      {results && results.length > 0 && (
        <ul className="space-y-1">
          {results.map((r) => (
            <li key={`${r.lat},${r.lng}`}>
              <button
                type="button"
                onClick={() => {
                  onPick({ id: `search:${r.lat},${r.lng}`, label: r.label, lat: r.lat, lng: r.lng });
                  setResults(null);
                  setQ("");
                }}
                className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default DestinationSearch;
