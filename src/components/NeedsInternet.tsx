import { Link } from "react-router-dom";
import { WifiOff } from "lucide-react";
import { useI18n } from "@/i18n";
import type { MessageKey } from "@/i18n/en";
import { useOnline } from "@/lib/offline";

// Shown on features that need a connection, when there isn't one: says so plainly and points
// to what still works (SOS texts and calls through the phone network).
const NeedsInternet = ({ message }: { message: MessageKey }) => {
  const { t } = useI18n();
  const online = useOnline();
  if (online) return null;
  return (
    <div role="alert" className="flex gap-3 rounded-2xl border border-warning/60 bg-warning/10 p-4 text-sm">
      <WifiOff className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
      <div className="space-y-1">
        <p className="font-semibold">{t(message)}</p>
        <p>
          {t("offline.useSos")}{" "}
          <Link to="/sos" className="font-semibold underline underline-offset-2">
            {t("offline.openSos")}
          </Link>
        </p>
      </div>
    </div>
  );
};

export default NeedsInternet;
