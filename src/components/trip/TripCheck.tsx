import { useState } from "react";
import { Route, ShieldCheck, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import type { MessageKey } from "@/i18n/en";
import { api } from "@/lib/api";
import { currentPosition } from "@/lib/location";
import { savedData } from "@/lib/offline";
import { metresBetween, type SavedPlace } from "@/lib/places";
import { alongTheWay, estimate, withinPeriod, type AlongTheWay, type Estimate, type RiskPoint } from "@/lib/risk";

type Help = { name: string | null; type: string; lat: number; lng: number; distance: number };
type Result = { km: number; way: AlongTheWay[]; there: Estimate; police: Help | null; noPosition: boolean };

const LEVEL: Record<number, MessageKey> = { 1: "risk.level1", 2: "risk.level2", 3: "risk.level3" };

// Before setting off: what's been reported along a straight line to the destination and around
// it, and the nearest police station there. Honest about being a straight line, not a route.
const TripCheck = ({ to }: { to: SavedPlace }) => {
  const { t, tn } = useI18n();
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);

  const check = async () => {
    setBusy(true);
    try {
      const [here, points, nearby] = await Promise.all([
        currentPosition(),
        api<{ points: RiskPoint[] }>("/api/reports/map")
          .then((r) => r.points)
          .catch(() => savedData.get<RiskPoint[]>("map")?.data ?? []),
        api<{ places: Omit<Help, "distance">[] }>(`/api/nearby?lat=${to.lat}&lng=${to.lng}`)
          .then((r) => r.places)
          .catch(() => [] as Omit<Help, "distance">[]),
      ]);
      const recent = points.filter((p) => withinPeriod(p, "12m"));
      const police =
        nearby
          .filter((p) => p.type === "police")
          .map((p) => ({ ...p, distance: metresBetween(p, to) }))
          .sort((a, b) => a.distance - b.distance)[0] ?? null;
      setResult({
        km: here ? metresBetween(here, to) / 1000 : 0,
        way: here ? alongTheWay(recent, here, to).filter((c) => c.level >= 1) : [],
        there: estimate(recent, to),
        police,
        noPosition: !here,
      });
    } finally {
      setBusy(false);
    }
  };

  const busiest = result ? Math.max(0, ...result.way.map((c) => c.level), result.there.enoughData ? result.there.level : 0) : 0;

  return (
    <section aria-labelledby="trip-title" className="space-y-3 rounded-xl border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="trip-title" className="flex items-center gap-2 text-sm font-semibold">
          <Route className="h-4 w-4 text-primary" /> {t("trip.title", { place: to.label })}
        </h3>
        <Button type="button" size="sm" variant="outline" onClick={check} disabled={busy}>
          {busy ? t("trip.checking") : result ? t("trip.again") : t("trip.check")}
        </Button>
      </div>
      {result && (
        <div className="space-y-2 text-sm" aria-live="polite">
          {result.noPosition ? (
            <p className="text-muted-foreground">{t("trip.noPosition")}</p>
          ) : (
            <p>{t("trip.distance", { km: result.km < 10 ? result.km.toFixed(1) : Math.round(result.km) })}</p>
          )}
          {!result.noPosition &&
            (result.way.length === 0 ? (
              <p className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" /> {t("trip.wayClear")}
              </p>
            ) : (
              <div className="space-y-1">
                <p className="flex items-start gap-2 font-semibold">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {tn("trip.wayAreas", result.way.length)}
                </p>
                <ol className="space-y-0.5 pl-6 text-muted-foreground">
                  {result.way.slice(0, 5).map((c) => (
                    <li key={`${c.lat}:${c.lng}`}>
                      {t("trip.wayStep", { percent: Math.round(c.at * 100), level: t(LEVEL[c.level]), count: c.count })}
                      {c.timeOfDay === "night" && <> · {t("areaWarn.night")}</>}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          <p>
            {result.there.count === 0 ? t("trip.thereNone") : tn("trip.there", result.there.count)}
            {result.there.timeOfDay === "night" && <> {t("areaWarn.night")}</>}
          </p>
          {result.police && (
            <p>
              {t("trip.police", {
                name: result.police.name ?? t("trip.policeUnnamed"),
                distance:
                  result.police.distance < 1000 ? `${Math.round(result.police.distance)} m` : `${(result.police.distance / 1000).toFixed(1)} km`,
              })}
            </p>
          )}
          {busiest >= 2 && <p className="rounded-lg bg-warning/10 p-2 font-medium">{t("trip.advice")}</p>}
          <p className="text-xs text-muted-foreground">{t("trip.disclaimer")}</p>
        </div>
      )}
    </section>
  );
};

export default TripCheck;
