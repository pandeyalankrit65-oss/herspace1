import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n";

// Placeholder rows shaped like the content that's loading; announced as "Loading" to screen readers.
const LoadingRows = ({ rows = 2, tall = false }: { rows?: number; tall?: boolean }) => {
  const { t } = useI18n();
  return (
    <div role="status" aria-busy="true" className="space-y-3">
      <span className="sr-only">{t("common.loading")}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border p-3">
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className={tall ? "h-12 w-full" : "h-3 w-1/2"} />
          </div>
        </div>
      ))}
    </div>
  );
};

export default LoadingRows;
