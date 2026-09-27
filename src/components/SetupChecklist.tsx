import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, ListChecks } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/i18n";
import type { MessageKey } from "@/i18n/en";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type Setup = { contacts: number; confirmed: number; testSent: boolean };
type LocationState = "granted" | "denied" | "prompt" | "unknown";

function useLocationPermission() {
  const [state, setState] = useState<LocationState>("unknown");
  useEffect(() => {
    let status: PermissionStatus | undefined;
    const update = () => status && setState(status.state as LocationState);
    navigator.permissions
      ?.query({ name: "geolocation" })
      .then((s) => {
        status = s;
        update();
        s.addEventListener("change", update);
      })
      .catch(() => {});
    return () => status?.removeEventListener("change", update);
  }, []);
  const request = () =>
    navigator.geolocation?.getCurrentPosition(
      () => setState("granted"),
      (err) => err.code === err.PERMISSION_DENIED && setState("denied")
    );
  return { state, request };
}

type Step = { key: string; title: MessageKey; desc: MessageKey; done: boolean; to?: string };

// A short "ready for an emergency" checklist for signed-in users. Hidden once everything is done,
// unless `showWhenDone` is set.
const SetupChecklist = ({ className, showWhenDone = false }: { className?: string; showWhenDone?: boolean }) => {
  const { t } = useI18n();
  const { user } = useAuth();
  const [setup, setSetup] = useState<Setup | null>(null);
  const location = useLocationPermission();

  const load = useCallback(() => {
    if (!user) return;
    api<Setup>("/api/account/setup")
      .then(setSetup)
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    load();
    // Contacts usually confirm on another phone, so refresh when the user comes back.
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

  if (!user || !setup) return null;

  const steps: Step[] = [
    { key: "contact", title: "setup.contact", desc: "setup.contactDesc", done: setup.contacts > 0, to: "/contacts" },
    { key: "confirmed", title: "setup.confirmed", desc: "setup.confirmedDesc", done: setup.confirmed > 0, to: "/contacts" },
    { key: "test", title: "setup.test", desc: "setup.testDesc", done: setup.testSent, to: "/contacts" },
  ];
  // Browsers without the Permissions API don't tell us; don't nag about something we can't check.
  if (location.state !== "unknown") {
    steps.push({ key: "location", title: "setup.location", desc: location.state === "denied" ? "setup.locationDenied" : "setup.locationDesc", done: location.state === "granted" });
  }
  const done = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done && s.to);

  if (done === steps.length) {
    if (!showWhenDone) return null;
    return (
      <p className={cn("flex items-center gap-2 rounded-xl border border-success/40 bg-success/10 px-4 py-3 text-sm font-medium", className)}>
        <CheckCircle2 className="h-5 w-5 shrink-0 text-success" /> {t("setup.allDone")}
      </p>
    );
  }

  return (
    <Card className={cn("border-primary/30", className)}>
      <CardContent className="space-y-4 p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ListChecks className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-bold">{t("setup.title")}</h2>
            <p className="text-xs text-muted-foreground">{t("setup.progress", { done, total: steps.length })}</p>
          </div>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(done / steps.length) * 100}%` }} />
        </div>
        <ol className="space-y-3">
          {steps.map((step, i) => (
            <li key={step.key} className="flex items-start gap-3">
              {step.done ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-label={t("setup.done")} />
              ) : (
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold text-muted-foreground">
                  {i + 1}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm font-semibold", step.done && "text-muted-foreground line-through")}>{t(step.title)}</p>
                {!step.done && <p className="text-xs text-muted-foreground">{t(step.desc)}</p>}
              </div>
              {step === next && (
                <Link to={step.to!}>
                  <Button size="sm" variant="hero">{t("setup.go")}</Button>
                </Link>
              )}
              {step.key === "location" && location.state === "prompt" && (
                <Button size="sm" variant="outline" onClick={location.request}>
                  {t("setup.allow")}
                </Button>
              )}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
};

export default SetupChecklist;
