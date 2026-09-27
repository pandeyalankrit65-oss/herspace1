import { ImageOff } from "lucide-react";
import { useI18n } from "@/i18n";
import { usePhotoUrl } from "@/lib/photos";

const Thumb = ({ reportId, photoId, n }: { reportId: number; photoId: number; n: number }) => {
  const { t } = useI18n();
  const { url, failed } = usePhotoUrl(reportId, photoId);
  const box = "block h-20 w-20 overflow-hidden rounded-lg border bg-muted";
  if (failed) {
    return (
      <span className={`${box} flex items-center justify-center text-muted-foreground`} title={t("report.photoAlt", { n })}>
        <ImageOff className="h-5 w-5" />
      </span>
    );
  }
  if (!url) return <span className={`${box} animate-pulse`} />;
  return (
    <a href={url} target="_blank" rel="noreferrer" className={box}>
      <img src={url} alt={t("report.photoAlt", { n })} className="h-full w-full object-cover" />
    </a>
  );
};

// Photos attached to a report, loaded with the viewer's session (owner or moderator).
const ReportPhotos = ({ reportId, photos }: { reportId: number; photos: number[] }) =>
  photos.length === 0 ? null : (
    <div className="flex flex-wrap gap-2 pt-1">
      {photos.map((id, i) => (
        <Thumb key={id} reportId={reportId} photoId={id} n={i + 1} />
      ))}
    </div>
  );

export default ReportPhotos;
