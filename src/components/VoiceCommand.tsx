import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { speechLocale, useI18n } from "@/i18n";
import type { MessageKey } from "@/i18n/en";
import { api, EMERGENCY_NUMBER } from "@/lib/api";
import { canListen, listenOnce, ListenFailed, type ListenError, type Listening } from "@/lib/listen";
import { isNative } from "@/lib/native";
import { offlineContacts } from "@/lib/offline";
import { parseCommand, type VoiceCommand as Command } from "@/lib/voice-commands";
import { cn } from "@/lib/utils";

type Contact = { name: string; phone: string; status?: string };
type Phase = { kind: "listening" } | { kind: "doing"; command: Command } | { kind: "unknown" } | { kind: "error"; error: ListenError };

const ERRORS: Record<ListenError, MessageKey> = {
  unsupported: isNative ? "sos.voiceUnsupportedApp" : "sos.voiceUnsupportedDesc",
  blocked: "sos.micBlockedDesc",
  noMic: "sos.voiceNoMic",
  network: "sos.voiceNetwork",
  nothing: "vc.nothing",
  other: "vc.nothing",
};

const EXAMPLES: MessageKey[] = ["vc.ex1", "vc.ex2", "vc.ex3", "vc.ex4", "vc.ex5", "vc.ex6"];

// Short pause so the user can read what's about to happen before it does.
const ACT_DELAY_MS = 900;

// A microphone button that understands spoken commands: "help", "call Mom", "start a 30 minute
// timer", "fake call", "sound the alarm", "share my location", "open the map"...
const VoiceCommand = () => {
  const { t } = useI18n();
  const { lang } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: "listening" });
  const [heard, setHeard] = useState("");
  const listening = useRef<Listening | null>(null);
  const contacts = useRef<Contact[]>([]);
  const actTimer = useRef<number>();

  const act = useCallback(
    (command: Command) => {
      setOpen(false);
      switch (command.type) {
        case "sos":
          return navigate("/sos?start=sos");
        case "alarm":
          return navigate("/sos?start=alarm");
        case "fakeCall":
          return navigate("/sos?start=fakecall");
        case "call":
          window.location.href = `tel:${command.phone.replace(/\s/g, "")}`;
          return;
        case "timer":
          return navigate(command.minutes ? `/timer?minutes=${command.minutes}` : "/timer");
        case "walk":
          return navigate("/walk");
        case "ride":
          return navigate("/walk?type=ride");
        case "map":
          return navigate("/map");
        case "report":
          return navigate("/report");
        case "chat":
          return navigate("/support");
        case "contacts":
          return navigate("/contacts");
        case "rights":
          return navigate("/help");
      }
    },
    [navigate]
  );

  const listen = useCallback(() => {
    window.clearTimeout(actTimer.current);
    listening.current?.stop();
    setHeard("");
    setPhase({ kind: "listening" });
    const session = listenOnce(speechLocale(lang), setHeard);
    listening.current = session;
    session.result
      .then((candidates) => {
        if (listening.current !== session) return;
        setHeard(candidates[0] ?? "");
        const command = parseCommand(candidates, contacts.current, EMERGENCY_NUMBER);
        if (command.type === "unknown") return setPhase({ kind: "unknown" });
        setPhase({ kind: "doing", command });
        actTimer.current = window.setTimeout(() => act(command), ACT_DELAY_MS);
      })
      .catch((err) => {
        if (listening.current !== session) return;
        setPhase({ kind: "error", error: err instanceof ListenFailed ? err.kind : "other" });
      });
  }, [lang, act]);

  const start = () => {
    // Contacts for "call ...": the copy on this phone, refreshed when online.
    contacts.current = offlineContacts.get<Contact>();
    if (user) {
      api<{ contacts: Contact[] }>("/api/contacts")
        .then((r) => {
          contacts.current = r.contacts;
        })
        .catch(() => {});
    }
    setOpen(true);
    listen();
  };

  const close = (next: boolean) => {
    if (next) return;
    window.clearTimeout(actTimer.current);
    listening.current?.stop();
    listening.current = null;
    setOpen(false);
  };

  useEffect(() => () => listening.current?.stop(), []);

  if (!canListen()) return null;

  const doing = phase.kind === "doing" ? phase.command : null;
  const doingText = doing
    ? doing.type === "call"
      ? t("vc.do.call", { name: doing.name })
      : doing.type === "timer" && doing.minutes
        ? t("vc.do.timerFor", { minutes: doing.minutes })
        : t(`vc.do.${doing.type}` as MessageKey)
    : "";

  return (
    <>
      <Button variant="ghost" size="icon" onClick={start} aria-label={t("vc.button")} title={t("vc.button")}>
        <Mic className="h-4 w-4" />
      </Button>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("vc.title")}</DialogTitle>
            <DialogDescription>{t("vc.desc")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2 text-center" aria-live="polite">
            <button
              type="button"
              onClick={listen}
              aria-label={t("vc.tryAgain")}
              className={cn(
                "flex h-20 w-20 items-center justify-center rounded-full text-white shadow-raised transition-colors",
                phase.kind === "listening" ? "bg-primary motion-safe:animate-pulse" : "bg-primary/70 hover:bg-primary"
              )}
            >
              <Mic className="h-9 w-9" />
            </button>
            <p className="min-h-[1.5rem] text-lg font-semibold">
              {heard ? `“${heard}”` : phase.kind === "listening" ? t("vc.listening") : ""}
            </p>
            {doing && (
              <p role="status" className="rounded-xl bg-success/10 px-4 py-2 font-semibold">
                {doingText}
              </p>
            )}
            {phase.kind === "unknown" && (
              <div className="space-y-2">
                <p className="font-semibold">{t("vc.unknown")}</p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {EXAMPLES.map((k) => (
                    <li key={k}>“{t(k)}”</li>
                  ))}
                </ul>
              </div>
            )}
            {phase.kind === "error" && (
              <p role="alert" className="text-sm text-destructive">
                {t(ERRORS[phase.error], { error: phase.error })}
              </p>
            )}
            {(phase.kind === "unknown" || phase.kind === "error") && (
              <Button variant="outline" onClick={listen}>
                {t("vc.tryAgain")}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default VoiceCommand;
