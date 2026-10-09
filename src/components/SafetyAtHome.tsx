import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Calculator, ClipboardList, Eraser, House, KeyRound, LogOut, MessageSquareLock, NotebookPen } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import { hashCode, readQuickExit, saveDisguise, saveQuickExit, useDisguise } from "@/lib/disguise";
import { neutraliseScheduledNotifications } from "@/lib/lockScreen";
import { wipePhone } from "@/lib/wipe";

const CODE = /^\d{4,8}$/;

// Settings for someone whose phone or home isn't safe: disguised mode, quick exit and a
// code phrase for contacts.
const SafetyAtHome = () => {
  const { t, tn } = useI18n();
  const { toast } = useToast();
  const { settings, lock, unlock } = useDisguise();
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [sosCode, setSosCode] = useState("");
  const [wipeCode, setWipeCode] = useState("");
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [wiping, setWiping] = useState(false);
  const [error, setError] = useState("");
  const [quickExit, setQuickExit] = useState(readQuickExit);
  const [phrase, setPhrase] = useState("");
  const [savedPhrase, setSavedPhrase] = useState<string | null>(null);
  const [savingPhrase, setSavingPhrase] = useState(false);

  useEffect(() => {
    api<{ phrase: string | null }>("/api/account/code-phrase")
      .then((r) => {
        setSavedPhrase(r.phrase);
        setPhrase(r.phrase ?? "");
      })
      .catch(() => {});
  }, []);

  const enableDisguise = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!CODE.test(pin)) return setError(t("safe.pinInvalid"));
    if (pin !== pin2) return setError(t("safe.pinMismatch"));
    if (sosCode && (!CODE.test(sosCode) || sosCode === pin)) return setError(t("safe.sosCodeInvalid"));
    if (wipeCode && (!CODE.test(wipeCode) || wipeCode === pin || wipeCode === sosCode)) return setError(t("safe.wipeCodeInvalid"));
    // Stays open for now; it locks next time the app opens or after a minute away.
    unlock();
    saveDisguise({
      enabled: true,
      pinHash: await hashCode(pin),
      sosCodeHash: sosCode ? await hashCode(sosCode) : null,
      wipeCodeHash: wipeCode ? await hashCode(wipeCode) : null,
    });
    void neutraliseScheduledNotifications();
    setPin("");
    setPin2("");
    setSosCode("");
    setWipeCode("");
    toast({ title: t("safe.disguiseOn"), description: t("safe.disguiseOnDesc") });
  };

  const savePhrase = async (value: string | null) => {
    setSavingPhrase(true);
    try {
      const res = await api<{ phrase: string | null; told: number }>("/api/account/code-phrase", { method: "PUT", body: { phrase: value } });
      setSavedPhrase(res.phrase);
      setPhrase(res.phrase ?? "");
      toast({ title: res.phrase ? tn("safe.phraseSaved", res.told) : t("safe.phraseRemoved") });
    } catch (err) {
      toast({ title: t("safe.phraseFailed"), description: (err as Error).message, variant: "destructive" });
    } finally {
      setSavingPhrase(false);
    }
  };

  return (
    <Card id="safety-at-home" className="scroll-mt-24">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <House className="h-5 w-5 text-primary" /> {t("safe.title")}
        </CardTitle>
        <CardDescription>{t("safe.desc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Link to="/safety-plan" className="flex items-start gap-3 rounded-xl bg-primary/5 p-3 ring-1 ring-primary/20 hover:bg-primary/10">
          <ClipboardList className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <span>
            <span className="block font-semibold">{t("plan.linkTitle")}</span>
            <span className="block text-sm text-muted-foreground">{t("plan.linkText")}</span>
          </span>
        </Link>
        <Link to="/record" className="flex items-start gap-3 rounded-xl bg-primary/5 p-3 ring-1 ring-primary/20 hover:bg-primary/10">
          <NotebookPen className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <span>
            <span className="block font-semibold">{t("record.linkTitle")}</span>
            <span className="block text-sm text-muted-foreground">{t("record.linkText")}</span>
          </span>
        </Link>
        {/* Disguised mode */}
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 font-semibold">
            <Calculator className="h-4 w-4 text-primary" /> {t("safe.disguiseTitle")}
          </h3>
          <p className="text-sm text-muted-foreground">{t("safe.disguiseDesc")}</p>
          {settings ? (
            <div className="space-y-3 rounded-xl border border-success/40 bg-success/10 p-3">
              <p className="text-sm font-semibold">{t("safe.disguiseActive")}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="hero" onClick={lock}>
                  {t("safe.lockNow")}
                </Button>
                <Button size="sm" variant="outline" onClick={() => saveDisguise(null)}>
                  {t("safe.turnOff")}
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={enableDisguise} className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="disguise-pin">{t("safe.pin")}</Label>
                <Input id="disguise-pin" inputMode="numeric" type="password" autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} maxLength={8} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="disguise-pin2">{t("safe.pinAgain")}</Label>
                <Input id="disguise-pin2" inputMode="numeric" type="password" autoComplete="off" value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, ""))} maxLength={8} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="disguise-sos">{t("safe.sosCode")}</Label>
                <Input id="disguise-sos" inputMode="numeric" type="password" autoComplete="off" value={sosCode} onChange={(e) => setSosCode(e.target.value.replace(/\D/g, ""))} maxLength={8} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="disguise-wipe">{t("safe.wipeCode")}</Label>
                <Input id="disguise-wipe" inputMode="numeric" type="password" autoComplete="off" value={wipeCode} onChange={(e) => setWipeCode(e.target.value.replace(/\D/g, ""))} maxLength={8} />
              </div>
              <p className="text-xs text-muted-foreground sm:col-span-2">{t("safe.pinHint")} {t("safe.wipeCodeHint")}</p>
              {error && (
                <p role="alert" className="text-sm text-destructive sm:col-span-2">
                  {error}
                </p>
              )}
              <Button type="submit" variant="hero" className="gap-2 sm:col-span-2 sm:w-fit">
                <KeyRound className="h-4 w-4" /> {t("safe.turnOn")}
              </Button>
            </form>
          )}
        </section>

        {/* Quick wipe */}
        <section className="space-y-3 border-t pt-5">
          <h3 className="flex items-center gap-2 font-semibold">
            <Eraser className="h-4 w-4 text-primary" /> {t("safe.wipeTitle")}
          </h3>
          <p className="text-sm text-muted-foreground">{t("safe.wipeDesc")}</p>
          {!confirmWipe ? (
            <Button variant="outline" onClick={() => setConfirmWipe(true)}>
              {t("safe.wipeButton")}
            </Button>
          ) : (
            <div role="alert" className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <p>{t("safe.wipeConfirm")}</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="destructive"
                  disabled={wiping}
                  onClick={async () => {
                    setWiping(true);
                    await wipePhone();
                    window.location.replace("/");
                  }}
                >
                  {t("safe.wipeNow")}
                </Button>
                <Button variant="ghost" onClick={() => setConfirmWipe(false)}>
                  {t("common.cancel")}
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* Quick exit */}
        <section className="flex items-start gap-3 border-t pt-5">
          <LogOut className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <label htmlFor="quick-exit" className="font-semibold">
              {t("safe.quickExitTitle")}
            </label>
            <p className="text-sm text-muted-foreground">{t("safe.quickExitDesc")}</p>
          </div>
          <Switch
            id="quick-exit"
            checked={quickExit}
            onCheckedChange={(on) => {
              setQuickExit(on);
              saveQuickExit(on);
            }}
          />
        </section>

        {/* Code phrase */}
        <section className="space-y-3 border-t pt-5">
          <h3 className="flex items-center gap-2 font-semibold">
            <MessageSquareLock className="h-4 w-4 text-primary" /> {t("safe.phraseTitle")}
          </h3>
          <p className="text-sm text-muted-foreground">{t("safe.phraseDesc")}</p>
          <p className="text-xs text-muted-foreground">{t("safe.phraseSpoken")}</p>
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              savePhrase(phrase.trim());
            }}
          >
            <Label htmlFor="code-phrase" className="sr-only">
              {t("safe.phraseTitle")}
            </Label>
            <Input id="code-phrase" value={phrase} maxLength={60} placeholder={t("safe.phrasePlaceholder")} onChange={(e) => setPhrase(e.target.value)} />
            <Button type="submit" variant="hero" className="shrink-0" disabled={savingPhrase || phrase.trim().length < 3 || phrase.trim() === savedPhrase}>
              {t("safe.phraseSave")}
            </Button>
          </form>
          {savedPhrase && (
            <button type="button" className="text-sm font-semibold text-primary underline underline-offset-2" onClick={() => savePhrase(null)}>
              {t("safe.phraseRemove")}
            </button>
          )}
        </section>
      </CardContent>
    </Card>
  );
};

export default SafetyAtHome;
