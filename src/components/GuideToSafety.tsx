import { useEffect, useRef, useState } from "react";
import { Navigation2, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { speechLocale, useI18n } from "@/i18n";
import { guidance, pickSafePlace, roundMetres, type Guidance, type SafePlace } from "@/lib/guide";
import { motionBetween } from "@/lib/motion";
import { speak, stopSpeaking } from "@/lib/speak";

type Fix = { lat: number; lng: number; accuracy?: number | null };

// Say it again this often while she's on the way, and whenever she's 100 m closer.
const REPEAT_MS = 30_000;
const REPEAT_CLOSER_M = 100;
// Her direction from positions at least this far apart in time; closer ones are mostly noise.
const HEADING_SAMPLE_MS = 5_000;

// After an SOS: the nearest place likely to have people (police, hospital, a pharmacy), said
// out loud with which way to go, again as she gets closer. Short sentences she can follow
// without looking at the screen.
const GuideToSafety = ({ position, told }: { position: Fix | null; told: string[] }) => {
  const { t, lang } = useI18n();
  const [guiding, setGuiding] = useState(false);
  const [state, setState] = useState<"idle" | "finding" | "found" | "none" | "unavailable">("idle");
  const [place, setPlace] = useState<SafePlace | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const sample = useRef<{ coords: Fix; at: number } | null>(null);
  const lastSaid = useRef<{ at: number; metres: number; arrived: boolean } | null>(null);

  // Her heading, from how she's moving.
  useEffect(() => {
    if (!position) return;
    const at = Date.now();
    const prev = sample.current;
    if (prev && at - prev.at < HEADING_SAMPLE_MS) return;
    sample.current = { coords: position, at };
    if (!prev) return;
    const motion = motionBetween(prev, position, at);
    if (motion) setHeading(motion.speed >= 0.4 ? motion.heading : null);
  }, [position]);

  const start = async () => {
    if (!position) return;
    setGuiding(true);
    setState("finding");
    lastSaid.current = null;
    try {
      const res = await api<{ available: boolean; places: SafePlace[] }>(`/api/nearby?lat=${position.lat}&lng=${position.lng}`);
      if (!res.available) return setState("unavailable");
      const best = pickSafePlace(res.places, position);
      setPlace(best);
      setState(best ? "found" : "none");
      if (!best) void speak(t("guide.none"), speechLocale(lang)).catch(() => {});
    } catch {
      setState("unavailable");
      void speak(t("guide.unavailable"), speechLocale(lang)).catch(() => {});
    }
  };

  const stop = () => {
    setGuiding(false);
    setState("idle");
    stopSpeaking();
  };

  const g: Guidance | null = guiding && place && position ? guidance(position, heading, place) : null;
  const placeName = place ? place.name ?? t(`guide.type.${place.type}`) : "";
  const where = g
    ? g.side
      ? t(`guide.side.${g.side}`, { metres: roundMetres(g.metres) })
      : t("guide.compass", { metres: roundMetres(g.metres), dir: t(`track.dir.${g.compass}`) })
    : "";
  const sentence = g
    ? g.arrived
      ? t("guide.arrived")
      : `${t("guide.say", { place: placeName, where })}${told.length ? ` ${t("guide.told", { names: told.join(", ") })}` : ""}`
    : "";

  // Speak at the start, then again every so often, as she gets closer, and on arrival.
  useEffect(() => {
    if (!g) return;
    const now = Date.now();
    const last = lastSaid.current;
    const due =
      !last || (g.arrived && !last.arrived) || (!g.arrived && (now - last.at >= REPEAT_MS || last.metres - g.metres >= REPEAT_CLOSER_M));
    if (!due) return;
    lastSaid.current = { at: now, metres: g.metres, arrived: g.arrived };
    void speak(sentence, speechLocale(lang)).catch(() => {});
  });

  useEffect(() => stopSpeaking, []);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Navigation2 className="h-5 w-5 text-primary" /> {t("guide.title")}
        </CardTitle>
        <CardDescription>{t("guide.desc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {guiding && (
          <p role="status" aria-live="polite" className="flex items-start gap-2 text-base font-semibold">
            <Volume2 className="mt-1 h-4 w-4 shrink-0 text-primary" aria-hidden />
            {state === "finding"
              ? t("guide.finding")
              : state === "none"
                ? t("guide.none")
                : state === "unavailable"
                  ? t("guide.unavailable")
                  : sentence}
          </p>
        )}
        {!position && <p className="text-sm text-muted-foreground">{t("guide.noLocation")}</p>}
        <div className="flex flex-wrap gap-2">
          {guiding ? (
            <Button type="button" variant="outline" onClick={stop}>
              {t("guide.stop")}
            </Button>
          ) : (
            <Button type="button" variant="hero" className="gap-2" onClick={start} disabled={!position}>
              <Volume2 className="h-4 w-4" /> {t("guide.start")}
            </Button>
          )}
          {guiding && place && (
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}&travelmode=walking`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-md px-3 py-2 text-sm font-semibold hover:bg-muted"
            >
              {t("guide.directions")}
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default GuideToSafety;
