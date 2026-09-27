import { useEffect, useRef, useState } from "react";
import { Navigation, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { api, ApiError } from "@/lib/api";
import { useI18n } from "@/i18n";
import { watchLocation, type Position } from "@/lib/location";

export type LiveShare = { id: number; expiresAt: string; url?: string };

const SEND_EVERY_MS = 20_000;
const SEND_IF_MOVED_M = 30;

// Rough distance in metres; plenty accurate for "has she moved?".
function metresBetween(a: Position, b: Position) {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x = dLng * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  return Math.sqrt(x * x + dLat * dLat) * 6_371_000;
}

type WakeLockSentinel = { release: () => Promise<void> };

// Streams the phone's position to the live share while this component is mounted, and
// offers "I'm safe" to stop. Browsers pause pages when the screen locks, so we ask for a
// screen wake lock and tell the user to keep the page open.
const LiveLocation = ({ share, onEnded }: { share: LiveShare; onEnded: () => void }) => {
  const { toast } = useToast();
  const { t } = useI18n();
  const [lastSent, setLastSent] = useState<Date | null>(null);
  // Holds a message key, so it re-renders in the current language.
  const [error, setError] = useState<"" | "live.noGeo" | "live.updateFailed" | "live.permission">("");
  const [stopping, setStopping] = useState(false);
  const lastRef = useRef<{ at: number; coords: Position } | null>(null);

  useEffect(() => {
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

    // In the Android app this keeps running with the screen locked (with a notification).
    const stop = watchLocation(
      async (pos) => {
        const last = lastRef.current;
        const due = !last || Date.now() - last.at >= SEND_EVERY_MS || metresBetween(last.coords, pos) >= SEND_IF_MOVED_M;
        if (!due) return;
        lastRef.current = { at: Date.now(), coords: pos };
        try {
          await api(`/api/location-shares/${share.id}/location`, { body: { coords: pos } });
          if (!cancelled) {
            setLastSent(new Date());
            setError("");
          }
        } catch (err) {
          if (err instanceof ApiError && (err.status === 410 || err.status === 404)) onEnded();
          else if (!cancelled) setError("live.updateFailed");
        }
      },
      (err) => !cancelled && setError(err === "denied" ? "live.permission" : "live.noGeo"),
      { title: t("native.liveTitle"), message: t("native.liveMessage") },
    );

    return () => {
      cancelled = true;
      stop();
      wakeLock?.release().catch(() => {});
    };
    // t is only used for the notification text when the watch starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [share.id, onEnded]);

  const stop = async () => {
    setStopping(true);
    try {
      await api(`/api/location-shares/${share.id}/stop`, { method: "POST" });
      toast({ title: t("live.safeTitle"), description: t("live.safeDesc") });
      onEnded();
    } catch (err) {
      toast({ title: t("live.stopFailed"), description: (err as Error).message, variant: "destructive" });
    } finally {
      setStopping(false);
    }
  };

  return (
    <Card className="mb-8 border-primary/60 bg-primary/5" aria-live="polite">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Navigation className="h-5 w-5 text-primary animate-pulse" />
          {t("live.title")}
        </CardTitle>
        <CardDescription>
          {t("live.desc", { time: new Date(share.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {error
            ? t(error)
            : lastSent
              ? t("live.lastSent", {
                  time: lastSent.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
                })
              : t("live.waiting")}
        </p>
        <Button variant="hero" size="lg" className="w-full sm:w-auto gap-2" onClick={stop} disabled={stopping}>
          <ShieldCheck className="h-5 w-5" />
          {stopping ? t("live.stopping") : t("live.safe")}
        </Button>
      </CardContent>
    </Card>
  );
};

export default LiveLocation;
