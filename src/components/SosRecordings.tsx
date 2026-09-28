import { useEffect, useState } from "react";
import { Mic } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import { apiUrl } from "@/lib/native";

type Piece = { id: number; size: number; recordedAt: string };
type Event = { id: number; createdAt: string; pieces: Piece[] };

// Recordings need the session cookie, so each piece is fetched and played from a local URL.
const Piece = ({ sosId, piece, n }: { sosId: number; piece: Piece; n: number }) => {
  const { t } = useI18n();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    fetch(apiUrl(`/api/sos/${sosId}/recordings/${piece.id}`), { credentials: "same-origin" })
      .then((r) => (r.ok ? r.blob() : Promise.reject()))
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [sosId, piece.id]);
  return (
    <li className="flex flex-wrap items-center gap-3">
      <span className="w-24 shrink-0 text-sm tabular-nums text-muted-foreground">
        {new Date(piece.recordedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </span>
      {url ? (
        <audio controls src={url} className="h-9 max-w-full flex-1" aria-label={t("rec.piece", { n })} />
      ) : (
        <span className="h-9 flex-1 animate-pulse rounded-full bg-muted" />
      )}
      {url && (
        <a href={url} download={`herspace-sos-${sosId}-${n}`} className="text-sm font-semibold text-primary underline underline-offset-2">
          {t("rec.download")}
        </a>
      )}
    </li>
  );
};

// Audio recorded during the user's SOS alerts. Only shown when there is some.
const SosRecordings = () => {
  const { t } = useI18n();
  const [events, setEvents] = useState<Event[]>([]);
  useEffect(() => {
    api<{ events: Event[] }>("/api/sos/recordings")
      .then((r) => setEvents(r.events))
      .catch(() => {});
  }, []);
  if (events.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mic className="h-5 w-5 text-primary" /> {t("rec.title")}
        </CardTitle>
        <CardDescription>{t("rec.desc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {events.map((e) => (
          <section key={e.id} className="space-y-2">
            <h3 className="font-semibold">{t("rec.alertAt", { time: new Date(e.createdAt).toLocaleString() })}</h3>
            <ol className="space-y-2">
              {e.pieces.map((p, i) => (
                <Piece key={p.id} sosId={e.id} piece={p} n={i + 1} />
              ))}
            </ol>
          </section>
        ))}
      </CardContent>
    </Card>
  );
};

export default SosRecordings;
