import { useEffect, useState } from "react";
import { Film, Mic, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { fetchMedia, formatSize, type ReportMedia } from "@/lib/media";

// One recording: loaded only when she presses Play (a video can be tens of megabytes).
const Item = ({ reportId, media, n }: { reportId: number; media: ReportMedia; n: number }) => {
  const { t } = useI18n();
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "failed">("idle");
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);
  const label = t(media.kind === "video" ? "media.video" : "media.audio", { n });
  const Icon = media.kind === "video" ? Film : Mic;

  const load = async () => {
    setState("loading");
    try {
      setUrl(await fetchMedia(reportId, media.id));
      setState("idle");
    } catch {
      setState("failed");
    }
  };

  return (
    <li className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Icon className="h-4 w-4 text-primary" />
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{formatSize(media.size)}</span>
        {!url && (
          <Button type="button" size="sm" variant="outline" className="gap-1" disabled={state === "loading"} onClick={load} aria-label={`${t("media.play")} ${label}`}>
            <Play className="h-3.5 w-3.5" /> {state === "loading" ? t("media.loading") : t("media.play")}
          </Button>
        )}
        {url && (
          <a
            href={url}
            download={`herspace-report-${reportId}-${n}`}
            aria-label={`${t("rec.download")} ${label}`}
            className="font-semibold text-primary underline underline-offset-2"
          >
            {t("rec.download")}
          </a>
        )}
        {state === "failed" && (
          <span role="alert" className="text-destructive">
            {t("media.failed")}
          </span>
        )}
      </div>
      {url &&
        (media.kind === "video" ? (
          <video controls autoPlay src={url} aria-label={label} className="max-h-72 w-full rounded-lg bg-black" />
        ) : (
          <audio controls autoPlay src={url} aria-label={label} className="h-9 w-full" />
        ))}
    </li>
  );
};

// Audio and video attached to a report, for the person who reported it and moderators.
const ReportMediaList = ({ reportId, media }: { reportId: number; media?: ReportMedia[] }) =>
  !media?.length ? null : (
    <ul className="space-y-2 pt-1">
      {media.map((m, i) => (
        <Item key={m.id} reportId={reportId} media={m} n={i + 1} />
      ))}
    </ul>
  );

export default ReportMediaList;
