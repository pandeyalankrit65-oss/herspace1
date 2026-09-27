import { useEffect, useRef, useState } from "react";
import { Navigation, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { api, ApiError } from "@/lib/api";

export type LiveShare = { id: number; expiresAt: string; url?: string };

const SEND_EVERY_MS = 20_000;
const SEND_IF_MOVED_M = 30;

// Rough distance in metres; plenty accurate for "has she moved?".
function metresBetween(a: GeolocationCoordinates, b: GeolocationCoordinates) {
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const x = dLng * Math.cos((((a.latitude + b.latitude) / 2) * Math.PI) / 180);
  return Math.sqrt(x * x + dLat * dLat) * 6_371_000;
}

type WakeLockSentinel = { release: () => Promise<void> };

// Streams the phone's position to the live share while this component is mounted, and
// offers "I'm safe" to stop. Browsers pause pages when the screen locks, so we ask for a
// screen wake lock and tell the user to keep the page open.
const LiveLocation = ({ share, onEnded }: { share: LiveShare; onEnded: () => void }) => {
  const { toast } = useToast();
  const [lastSent, setLastSent] = useState<Date | null>(null);
  const [error, setError] = useState("");
  const [stopping, setStopping] = useState(false);
  const lastRef = useRef<{ at: number; coords: GeolocationCoordinates } | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError("This browser can't share location.");
      return;
    }
    let cancelled = false;
    let wakeLock: WakeLockSentinel | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> } };
    nav.wakeLock
      ?.request("screen")
      .then((lock) => {
        if (cancelled) lock.release().catch(() => {});
        else wakeLock = lock;
      })
      .catch(() => {});

    const watch = navigator.geolocation.watchPosition(
      async (pos) => {
        const last = lastRef.current;
        const due = !last || Date.now() - last.at >= SEND_EVERY_MS || metresBetween(last.coords, pos.coords) >= SEND_IF_MOVED_M;
        if (!due) return;
        lastRef.current = { at: Date.now(), coords: pos.coords };
        try {
          await api(`/api/location-shares/${share.id}/location`, {
            body: { coords: { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy } },
          });
          if (!cancelled) {
            setLastSent(new Date());
            setError("");
          }
        } catch (err) {
          if (err instanceof ApiError && (err.status === 410 || err.status === 404)) onEnded();
          else if (!cancelled) setError("Couldn't update your location. Retrying...");
        }
      },
      () => !cancelled && setError("Location permission is off, so your contacts can't see where you are."),
      { enableHighAccuracy: true, maximumAge: 10_000 }
    );

    return () => {
      cancelled = true;
      navigator.geolocation.clearWatch(watch);
      wakeLock?.release().catch(() => {});
    };
  }, [share.id, onEnded]);

  const stop = async () => {
    setStopping(true);
    try {
      await api(`/api/location-shares/${share.id}/stop`, { method: "POST" });
      toast({ title: "Glad you're safe", description: "Location sharing has stopped and your location was removed." });
      onEnded();
    } catch (err) {
      toast({ title: "Couldn't stop sharing", description: (err as Error).message, variant: "destructive" });
    } finally {
      setStopping(false);
    }
  };

  return (
    <Card className="mb-8 border-primary/60 bg-primary/5" aria-live="polite">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Navigation className="h-5 w-5 text-primary animate-pulse" />
          Sharing your live location
        </CardTitle>
        <CardDescription>
          Your contacts can follow you on a map until you tap "I'm safe". Keep this page open: sharing pauses if the screen
          locks or you switch apps. It stops automatically at {new Date(share.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {error ||
            (lastSent
              ? `Last sent at ${lastSent.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
              : "Waiting for your location...")}
        </p>
        <Button variant="hero" size="lg" className="w-full sm:w-auto gap-2" onClick={stop} disabled={stopping}>
          <ShieldCheck className="h-5 w-5" />
          {stopping ? "Stopping..." : "I'm safe, stop sharing"}
        </Button>
      </CardContent>
    </Card>
  );
};

export default LiveLocation;
