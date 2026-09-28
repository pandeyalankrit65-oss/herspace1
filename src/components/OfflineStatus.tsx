import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { WifiOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import { useOnline } from "@/lib/offline";
import { sendQueuedReports } from "@/lib/outbox";

// Shows a small "offline" pill on every page (the SOS page has its own, fuller notice), and
// sends reports saved while offline as soon as the connection is back.
const OfflineStatus = () => {
  const { t, tn } = useI18n();
  const { toast } = useToast();
  const online = useOnline();
  const { pathname } = useLocation();

  useEffect(() => {
    if (online) sendQueuedReports();
  }, [online]);

  useEffect(() => {
    const onSent = (e: Event) => toast({ title: tn("offline.reportsSent", (e as CustomEvent<number>).detail) });
    window.addEventListener("herspace-outbox-sent", onSent);
    return () => window.removeEventListener("herspace-outbox-sent", onSent);
  }, [toast, tn]);

  if (online || pathname === "/sos") return null;
  return (
    <div role="status" className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex justify-center px-4 lg:bottom-6">
      <Link
        to="/sos"
        className="pointer-events-auto flex max-w-md items-center gap-2 rounded-full border border-warning/60 bg-card px-4 py-2 text-sm font-semibold shadow-raised"
      >
        <WifiOff className="h-4 w-4 shrink-0 text-warning" />
        {t("offline.pill")}
      </Link>
    </div>
  );
};

export default OfflineStatus;
