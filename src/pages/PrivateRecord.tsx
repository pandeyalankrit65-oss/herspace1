import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Camera, KeyRound, Lock, NotebookPen, Printer, ShieldCheck, Trash2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { speechLocale, useI18n } from "@/i18n";
import { ApiError } from "@/lib/api";
import {
  addEntry,
  addFile,
  createRecord,
  deleteEntry,
  deleteWholeRecord,
  lockRecord,
  openRecord,
  readFile,
  recordStatus,
  setNewPin,
  type OpenEntry,
  type OpenRecord,
  type RecordEntry,
} from "@/lib/record";
import { pinIsStrongEnough } from "@/lib/recordCrypto";
import { onAppVisibility } from "@/lib/appVisibility";

// Locks itself after this long without a tap or key, and at once when the app is hidden.
const IDLE_LOCK_MS = 3 * 60 * 1000;

type Status = Awaited<ReturnType<typeof recordStatus>>;
const today = () => new Date().toLocaleDateString("en-CA");
const emptyEntry = (): RecordEntry => ({ date: today(), time: "", what: "", injuries: "", witnesses: "" });

// A private record for someone living with abuse: what happened, when, injuries, witnesses,
// photos. Encrypted on the phone with a key only her PIN (or recovery code) opens; never on the
// map, never in the gallery, never kept on the phone.
const PrivateRecord = () => {
  const { t } = useI18n();
  const { user, loading } = useAuth();
  const [status, setStatus] = useState<Status | null>(null);
  const [record, setRecord] = useState<OpenRecord | null>(null);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [needsNewPin, setNeedsNewPin] = useState(false);
  const recordRef = useRef(record);
  recordRef.current = record;
  // Choosing a photo hides the page on a phone; that mustn't lock the record mid-entry.
  const pickingRef = useRef(false);

  useEffect(() => {
    if (user) recordStatus().then(setStatus).catch(() => setStatus(null));
  }, [user]);

  const lock = useCallback(() => {
    void lockRecord(recordRef.current);
    setRecord(null);
    setRecoveryCode(null);
    setNeedsNewPin(false);
    recordStatus().then(setStatus).catch(() => {});
  }, []);

  // Lock when the app goes to the background (someone takes the phone), or after a while idle.
  useEffect(() => {
    if (!record) return;
    let timer = window.setTimeout(lock, IDLE_LOCK_MS);
    const activity = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(lock, IDLE_LOCK_MS);
    };
    const stopWatching = onAppVisibility((visible) => !visible && !pickingRef.current && lock());
    window.addEventListener("pointerdown", activity);
    window.addEventListener("keydown", activity);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", activity);
      window.removeEventListener("keydown", activity);
      stopWatching();
    };
  }, [record, lock]);

  // Leaving the page locks it too.
  useEffect(() => () => void lockRecord(recordRef.current), []);

  const body = () => {
    if (!loading && !user) {
      return (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <p>{t("record.loginDesc")}</p>
            <Link to="/login?next=/record">
              <Button variant="hero">{t("common.logIn")}</Button>
            </Link>
          </CardContent>
        </Card>
      );
    }
    if (!status) return <p className="text-muted-foreground">{t("common.loading")}</p>;
    if (recoveryCode && record) return <RecoveryCode code={recoveryCode} onDone={() => setRecoveryCode(null)} />;
    if (record && needsNewPin) return <NewPin record={record} onDone={() => setNeedsNewPin(false)} />;
    if (record)
      return (
        <RecordView
          record={record}
          setRecord={setRecord}
          onLock={lock}
          pickingRef={pickingRef}
          onDeleted={() => {
            setRecord(null);
            setStatus({ exists: false });
          }}
        />
      );
    if (!status.exists)
      return (
        <Setup
          onCreated={(r, code) => {
            setRecord(r);
            setRecoveryCode(code);
          }}
        />
      );
    return (
      <Unlock
        status={status}
        onOpened={(r, byRecovery) => {
          setRecord(r);
          setNeedsNewPin(byRecovery);
        }}
        onLocked={setStatus}
      />
    );
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="px-4 pb-16 pt-24">
        <div className="container mx-auto max-w-3xl space-y-6">
          <div className="print:hidden">
            <PageHeader icon={NotebookPen} title={t("record.title")} subtitle={t("record.intro")} />
          </div>
          {body()}
        </div>
      </main>
      <div className="print:hidden">
        <Footer />
      </div>
    </div>
  );
};

const PinFields = ({ pin, setPin, again, setAgain }: { pin: string; setPin: (v: string) => void; again: string; setAgain: (v: string) => void }) => {
  const { t } = useI18n();
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1">
        <Label htmlFor="record-pin">{t("record.pin")}</Label>
        <Input id="record-pin" type="password" autoComplete="new-password" value={pin} onChange={(e) => setPin(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="record-pin-again">{t("record.pinAgain")}</Label>
        <Input id="record-pin-again" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
      </div>
    </div>
  );
};

const pinProblem = (pin: string, again: string) => (!pinIsStrongEnough(pin) ? "record.pinWeak" : pin !== again ? "record.pinMismatch" : null);

const Setup = ({ onCreated }: { onCreated: (record: OpenRecord, recoveryCode: string) => void }) => {
  const { t } = useI18n();
  const [pin, setPin] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const problem = pinProblem(pin, again);
    if (problem) return setError(t(problem));
    setBusy(true);
    setError("");
    try {
      const { record, recoveryCode } = await createRecord(pin);
      onCreated(record, recoveryCode);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" /> {t("record.setupTitle")}
        </CardTitle>
        <CardDescription>{t("record.setupDesc")}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="mb-4 list-disc space-y-1 pl-5 text-sm">
          <li>{t("record.how1")}</li>
          <li>{t("record.how2")}</li>
          <li>{t("record.how3")}</li>
          <li>{t("record.how4")}</li>
        </ul>
        <form onSubmit={submit} className="space-y-4">
          <PinFields pin={pin} setPin={setPin} again={again} setAgain={setAgain} />
          <p className="text-xs text-muted-foreground">{t("record.pinHint")}</p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" variant="hero" disabled={busy}>
            {busy ? t("record.working") : t("record.create")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

// Shown once. Without it, a forgotten PIN means the record can't be opened by anyone.
const RecoveryCode = ({ code, onDone }: { code: string; onDone: () => void }) => {
  const { t } = useI18n();
  const [saved, setSaved] = useState(false);
  return (
    <Card className="border-primary/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary" /> {t("record.recoveryTitle")}
        </CardTitle>
        <CardDescription>{t("record.recoveryDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="rounded-xl bg-muted p-4 text-center font-mono text-xl font-bold tracking-wider" aria-label={t("record.recoveryTitle")}>
          {code}
        </p>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={saved} onCheckedChange={(v) => setSaved(v === true)} className="mt-0.5" />
          {t("record.recoverySaved")}
        </label>
        <Button variant="hero" disabled={!saved} onClick={onDone}>
          {t("record.continue")}
        </Button>
      </CardContent>
    </Card>
  );
};

const Unlock = ({ status, onOpened, onLocked }: { status: Extract<Status, { exists: true }>; onOpened: (r: OpenRecord, byRecovery: boolean) => void; onLocked: (s: Status) => void }) => {
  const { t } = useI18n();
  const [by, setBy] = useState<"pin" | "recovery">("pin");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lockedUntil = status.lockedUntil ? new Date(status.lockedUntil) : null;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      onOpened(await openRecord(secret, by === "pin" ? status.salt : status.recoverySalt, by), by === "recovery");
    } catch (err) {
      // Server messages are in English: say it in her language.
      if (err instanceof ApiError && err.status === 429) onLocked(await recordStatus());
      else setError(t(err instanceof ApiError && err.status === 401 ? "record.wrongPin" : "record.openFailed"));
    } finally {
      setSecret("");
      setBusy(false);
    }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-primary" /> {t("record.lockedTitle")}
        </CardTitle>
        <CardDescription>{t(by === "pin" ? "record.lockedDesc" : "record.recoverDesc")}</CardDescription>
      </CardHeader>
      <CardContent>
        {lockedUntil ? (
          <p role="alert" className="text-sm">
            {t("record.lockedOut", { time: lockedUntil.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) })}
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="record-secret">{t(by === "pin" ? "record.pin" : "record.recoveryLabel")}</Label>
              <Input
                id="record-secret"
                type={by === "pin" ? "password" : "text"}
                autoComplete="off"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" variant="hero" disabled={busy || !secret}>
                {busy ? t("record.working") : t("record.open")}
              </Button>
              <button type="button" className="text-sm underline-offset-2 hover:underline" onClick={() => setBy(by === "pin" ? "recovery" : "pin")}>
                {t(by === "pin" ? "record.forgot" : "record.usePin")}
              </button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
};

const NewPin = ({ record, onDone }: { record: OpenRecord; onDone: () => void }) => {
  const { t } = useI18n();
  const [pin, setPin] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const problem = pinProblem(pin, again);
    if (problem) return setError(t(problem));
    setBusy(true);
    try {
      await setNewPin(record, pin);
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("record.newPinTitle")}</CardTitle>
        <CardDescription>{t("record.newPinDesc")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <PinFields pin={pin} setPin={setPin} again={again} setAgain={setAgain} />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" variant="hero" disabled={busy}>
            {busy ? t("record.working") : t("record.savePin")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

const RecordView = ({
  record,
  setRecord,
  onLock,
  onDeleted,
  pickingRef,
}: {
  record: OpenRecord;
  setRecord: (r: OpenRecord) => void;
  onLock: () => void;
  onDeleted: () => void;
  pickingRef: { current: boolean };
}) => {
  const { t, tn } = useI18n();
  const [entry, setEntry] = useState<RecordEntry>(emptyEntry);
  const [photos, setPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState("");
  const set = (k: keyof RecordEntry) => (e: { target: { value: string } }) => setEntry({ ...entry, [k]: e.target.value });

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!entry.what.trim()) return;
    setBusy(true);
    setError("");
    try {
      const created = await addEntry(record, entry);
      const files: OpenEntry["files"] = [];
      for (const p of photos) files.push(await addFile(record, created.id, p));
      setRecord({ ...record, entries: [{ ...entry, id: created.id, createdAt: created.createdAt, files }, ...record.entries] });
      setEntry(emptyEntry());
      setPhotos([]);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? t("record.timedOut") : (err as Error).message);
      if (err instanceof ApiError && err.status === 401) onLock();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    await deleteEntry(record, id);
    setRecord({ ...record, entries: record.entries.filter((e) => e.id !== id) });
  };

  return (
    <>
      <div className="flex flex-wrap gap-2 print:hidden">
        <Button variant="outline" className="gap-2" onClick={onLock}>
          <Lock className="h-4 w-4" /> {t("record.lockNow")}
        </Button>
        {record.entries.length > 0 && (
          <Button variant="outline" className="gap-2" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> {t("record.print")}
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground print:hidden">{t("record.autoLock")}</p>

      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>{t("record.addTitle")}</CardTitle>
          <CardDescription>{t("record.addDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="rec-date">{t("record.date")}</Label>
                <Input id="rec-date" type="date" max={today()} value={entry.date} onChange={set("date")} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rec-time">{t("record.time")}</Label>
                <Input id="rec-time" type="time" value={entry.time} onChange={set("time")} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="rec-what">{t("record.what")}</Label>
              <Textarea id="rec-what" className="min-h-32" placeholder={t("record.whatHint")} value={entry.what} onChange={set("what")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rec-injuries">{t("record.injuries")}</Label>
              <Textarea id="rec-injuries" placeholder={t("record.injuriesHint")} value={entry.injuries} onChange={set("injuries")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rec-witnesses">{t("record.witnesses")}</Label>
              <Input id="rec-witnesses" placeholder={t("record.witnessesHint")} value={entry.witnesses} onChange={set("witnesses")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rec-photos" className="flex items-center gap-2">
                <Camera className="h-4 w-4" /> {t("record.photos")}
              </Label>
              <Input
                id="rec-photos"
                type="file"
                accept="image/*"
                multiple
                onClick={() => (pickingRef.current = true)}
                onChange={(e) => {
                  pickingRef.current = false;
                  setPhotos(Array.from(e.target.files ?? []).slice(0, 6));
                }}
                // Cancelled picker: no change event, but the window gets focus back.
                onBlur={() => window.setTimeout(() => (pickingRef.current = false), 1000)}
              />
              <p className="text-xs text-muted-foreground">{t("record.photosHint")}</p>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" variant="hero" disabled={busy || !entry.what.trim()}>
              {busy ? t("record.working") : t("record.save")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <section aria-labelledby="record-entries" className="space-y-3">
        <h2 id="record-entries" className="text-xl font-bold">
          {tn("record.entries", record.entries.length)}
        </h2>
        {record.entries.map((e) => (
          <EntryCard key={e.id} record={record} entry={e} onDelete={() => remove(e.id)} />
        ))}
      </section>

      <Card className="border-destructive/30 print:hidden">
        <CardHeader>
          <CardTitle className="text-base">{t("record.deleteTitle")}</CardTitle>
          <CardDescription>{t("record.deleteDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="record-delete">{t("record.deleteType")}</Label>
            <Input id="record-delete" value={confirmDelete} onChange={(e) => setConfirmDelete(e.target.value)} />
          </div>
          <Button
            variant="destructive"
            disabled={confirmDelete.trim().toUpperCase() !== "DELETE"}
            onClick={async () => {
              await deleteWholeRecord(record);
              onDeleted();
            }}
          >
            {t("record.deleteAll")}
          </Button>
        </CardContent>
      </Card>
    </>
  );
};

const EntryCard = ({ record, entry, onDelete }: { record: OpenRecord; entry: OpenEntry; onDelete: () => void }) => {
  const { t, tn, lang } = useI18n();
  const [urls, setUrls] = useState<string[]>([]);
  // Photos are decrypted only when asked for, and forgotten when the record locks.
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  const showPhotos = async () => setUrls(await Promise.all(entry.files.map(async (f) => URL.createObjectURL(await readFile(record, f)))));
  const when = [new Date(`${entry.date}T00:00:00`).toLocaleDateString(speechLocale(lang), { dateStyle: "long" }), entry.time].filter(Boolean).join(", ");
  return (
    <article className="space-y-2 rounded-xl border border-border p-4 print:break-inside-avoid">
      <h3 className="font-semibold">{when}</h3>
      <p className="whitespace-pre-wrap">{entry.what}</p>
      {entry.injuries && (
        <p className="text-sm">
          <strong>{t("record.injuries")}:</strong> {entry.injuries}
        </p>
      )}
      {entry.witnesses && (
        <p className="text-sm">
          <strong>{t("record.witnesses")}:</strong> {entry.witnesses}
        </p>
      )}
      {urls.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {urls.map((u, i) => (
            <img key={u} src={u} alt={t("record.photoAlt", { n: i + 1 })} className="h-32 w-32 rounded-lg object-cover print:h-48 print:w-48" />
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">{t("record.written", { time: new Date(entry.createdAt).toLocaleString() })}</p>
      <div className="flex flex-wrap gap-3 text-sm print:hidden">
        {entry.files.length > 0 && urls.length === 0 && (
          <button type="button" className="font-semibold underline-offset-2 hover:underline" onClick={() => void showPhotos()}>
            {tn("record.showPhotos", entry.files.length)}
          </button>
        )}
        <button type="button" className="flex items-center gap-1 text-destructive underline-offset-2 hover:underline" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" /> {t("record.deleteEntry")}
        </button>
      </div>
    </article>
  );
};

export default PrivateRecord;
