import { AudioLines, Activity } from "lucide-react";
import { useI18n } from "@/i18n";
import type { MessageKey } from "@/i18n/en";
import type { useScreamTrigger } from "@/hooks/use-scream-trigger";
import type { useVoiceStress } from "@/hooks/use-voice-stress";
import { cn } from "@/lib/utils";

const SCREAM: Record<string, MessageKey | null> = {
  off: null,
  starting: "scream.starting",
  listening: "scream.listening",
  needsTap: "scream.needsTap",
  denied: "scream.denied",
  unsupported: "scream.unsupported",
  error: "scream.error",
};
const STRESS: Record<string, MessageKey | null> = {
  off: null,
  starting: "stress.starting",
  listening: "stress.listening",
  needsTap: "scream.needsTap",
  denied: "scream.denied",
  unsupported: "stress.unsupported",
  error: "scream.error",
};

// One line each for the listeners she turned on, shown while the SOS settings are folded away,
// so a problem ("tap to start listening", microphone blocked) is never hidden.
const ListeningStatus = ({ scream, stress }: { scream: ReturnType<typeof useScreamTrigger>; stress: ReturnType<typeof useVoiceStress> }) => {
  const { t } = useI18n();
  const lines = [
    scream.enabled && SCREAM[scream.status] ? { key: "scream", icon: AudioLines, text: SCREAM[scream.status]!, ok: scream.status === "listening" || scream.status === "starting" } : null,
    stress.enabled && STRESS[stress.status] ? { key: "stress", icon: Activity, text: STRESS[stress.status]!, ok: stress.status === "listening" || stress.status === "starting" } : null,
  ].filter(Boolean) as Array<{ key: string; icon: typeof AudioLines; text: MessageKey; ok: boolean }>;
  if (!lines.length) return null;
  return (
    <div className="mx-auto max-w-md space-y-1 text-left">
      {lines.map(({ key, icon: Icon, text, ok }) => (
        <p key={key} role="status" className={cn("flex items-center gap-2 text-xs font-semibold", ok ? "text-success" : "text-destructive")}>
          <Icon className="h-3.5 w-3.5 shrink-0" /> {t(text)}
        </p>
      ))}
    </div>
  );
};

export default ListeningStatus;
