import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { WifiOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import { useOnline } from "@/lib/offline";
import { useAuth } from "@/contexts/AuthContext";
import { sendQueuedReports } from "@/lib/outbox";
import { api } from "@/lib/api";

// Retry intervals: queued reports while online (in case a send failed), and a light check for
// the connection coming back while offline (some phones never fire the "online" event).
const RESEND_MS = 60_000;
const RECHECK_MS = 15_000;

// Shows a small "offline" pill on other pages, and
// sends reports saved while offline as soon as the connection is back.
const OfflineStatus = () => {
  const { t, tn } = useI18n();
  const { toast } = useToast();
  const online = useOnline();
  const { pathname } = useLocation();
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;

  useEffect(() => {
    if (loading) return;
    const retry = () => {
      if (document.visibilityState !== "visible") return;
      if (online) sendQueuedReports(userId);
      else api("/api/health").catch(() => {});
    };
    if (online) sendQueuedReports(userId);
    const timer = setInterval(retry, online ? RESEND_MS : RECHECK_MS);
    document.addEventListener("visibilitychange", retry);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", retry);
    };
  }, [online, loading, userId]);

  useEffect(() => {
    const onSent = (e: Event) => toast({ title: tn("offline.reportsSent", (e as CustomEvent<number>).detail) });
    window.addEventListener("herspace-outbox-sent", onSent);
    return () => window.removeEventListener("herspace-outbox-sent", onSent);
  }, [toast, tn]);

  // The SOS page and the signed-in home page have their own, fuller notice; there the pill would
  // only cover the SOS button.
  if (online || pathname === "/sos" || (pathname === "/" && user)) return null;
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
