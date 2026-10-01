import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, FileText, Printer } from "lucide-react";
import Navbar from "@/components/Navbar";
import LoadingRows from "@/components/LoadingRows";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/i18n";
import type { MessageKey } from "@/i18n/en";
import { api, ApiError } from "@/lib/api";
import { usePhotoUrl } from "@/lib/photos";
import { buildComplaint } from "@/content/complaint";
import { printPage } from "@/lib/print";

type Delivery = { name: string; channel: "sms" | "call"; status: string };
type SosEvent = {
  id: number;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  createdAt: string;
  alerted: Delivery[];
  responses: Array<{ name: string | null; at: string }>;
  recordings: { pieces: number; bytes: number; first: string | null; last: string | null };
};
type Pack = {
  generatedAt: string;
  user: { name: string; phone: string | null };
  report: {
    id: number;
    incidentType: string;
    description: string;
    location: string | null;
    lat: number | null;
    lng: number | null;
    date: string | null;
    createdAt: string;
    photos: number[];
  };
  sosEvents: SosEvent[];
  window: { from: string; to: string };
};

const REPORT_TYPES = ["harassment", "assault", "stalking", "threat", "discrimination", "other"];
const dateTime = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "medium" });
const time = (iso: string) => new Date(iso).toLocaleTimeString([], { timeStyle: "medium" });
const coords = (lat: number, lng: number) => `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
const fileSize = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

const Photo = ({ reportId, photoId, n }: { reportId: number; photoId: number; n: number }) => {
  const { t } = useI18n();
  const { url, failed } = usePhotoUrl(reportId, photoId);
  return (
    <figure className="break-inside-avoid space-y-1">
      {url ? (
        <img src={url} alt={t("report.photoAlt", { n })} className="max-h-80 w-full rounded border border-neutral-300 object-contain" />
      ) : (
        <div className={`h-40 rounded border border-neutral-300 bg-neutral-100 ${failed ? "" : "animate-pulse"}`} />
      )}
      <figcaption className="text-xs text-neutral-600">{t("report.photoAlt", { n })}</figcaption>
    </figure>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-3 border-t border-neutral-300 pt-5">
    <h2 className="text-lg font-bold">{title}</h2>
    {children}
  </section>
);

// One incident report with the SOS alerts around it and a draft complaint, laid out as a
// document to save as PDF or print (the browser's print dialog handles every script and the
// photos). Built from the user's own records; nothing is sent anywhere.
const Evidence = () => {
  const { id = "" } = useParams();
  const { t, lang } = useI18n();
  const { user, loading } = useAuth();
  const [pack, setPack] = useState<Pack | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!user) return;
    api<Pack>(`/api/reports/${encodeURIComponent(id)}/evidence`)
      .then(setPack)
      .catch((err) => setMissing(err instanceof ApiError && err.status === 404));
  }, [id, user]);

  const letter = useMemo(() => {
    if (!pack) return "";
    const r = pack.report;
    return buildComplaint(
      {
        kind: "police",
        to: "",
        name: pack.user.name,
        phone: pack.user.phone ?? "",
        address: "",
        date: r.date ?? r.createdAt.slice(0, 10),
        place: r.location ?? "",
        description: r.description,
        accused: "",
        witnesses: "",
        attachments: r.photos.length,
      },
      lang,
    );
  }, [pack, lang]);

  const delivery = (d: Delivery) => {
    if (d.channel === "call") {
      const call: Record<string, MessageKey> = { answered: "sos.delivery.callAnswered", unanswered: "sos.delivery.callUnanswered", failed: "sos.delivery.callFailed" };
      return t(call[d.status] ?? "evidence.callPlaced");
    }
    const sms: Record<string, MessageKey> = {
      delivered: "sos.delivery.smsDelivered",
      sent: "sos.delivery.smsSent",
      failed: "sos.delivery.smsFailed",
      not_confirmed: "sos.delivery.notConfirmed",
      not_configured: "sos.delivery.notConfigured",
    };
    return t(sms[d.status] ?? "sos.delivery.smsSent");
  };

  const body = () => {
    if (!loading && !user) {
      return (
        <p className="text-muted-foreground">
          <Link to={`/login?next=/evidence/${id}`} className="font-semibold text-primary underline">
            {t("common.logIn")}
          </Link>
        </p>
      );
    }
    if (missing) return <p className="text-muted-foreground">{t("evidence.notFound")}</p>;
    if (!pack) return <LoadingRows rows={3} tall />;
    const r = pack.report;
    const day = (iso: string) => new Date(iso).toLocaleDateString([], { dateStyle: "medium" });
    return (
      // Always light, like paper, so the preview matches what prints.
      <article className="print-doc space-y-5 rounded-lg bg-white p-6 text-neutral-900 shadow-sm ring-1 ring-neutral-200 sm:p-10 print:p-0 print:shadow-none print:ring-0">
        <header className="space-y-1">
          <h1 className="text-2xl font-extrabold">{t("evidence.docTitle")}</h1>
          <p className="text-sm text-neutral-600">{t("evidence.preparedBy", { name: pack.user.name, date: dateTime(pack.generatedAt) })}</p>
        </header>

        <Section title={t("evidence.incident")}>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
            <dt className="font-semibold">{t("evidence.type")}</dt>
            <dd>{REPORT_TYPES.includes(r.incidentType) ? t(`report.types.${r.incidentType}` as MessageKey) : r.incidentType}</dd>
            <dt className="font-semibold">{t("evidence.when")}</dt>
            <dd>{r.date ? day(`${r.date}T12:00:00`) : "—"}</dd>
            <dt className="font-semibold">{t("evidence.where")}</dt>
            <dd>
              {r.location || "—"}
              {r.lat !== null && r.lng !== null && <span className="block text-neutral-600">{t("evidence.coords", { coords: coords(r.lat, r.lng) })}</span>}
            </dd>
            <dt className="font-semibold">{t("evidence.reported")}</dt>
            <dd>{dateTime(r.createdAt)}</dd>
          </dl>
          <h3 className="pt-2 text-sm font-semibold">{t("evidence.description")}</h3>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{r.description}</p>
        </Section>

        {r.photos.length > 0 && (
          <Section title={t("evidence.photos", { count: r.photos.length })}>
            <div className="grid gap-4 sm:grid-cols-2">
              {r.photos.map((photoId, i) => (
                <Photo key={photoId} reportId={r.id} photoId={photoId} n={i + 1} />
              ))}
            </div>
            <p className="text-xs text-neutral-600">{t("evidence.photosNote")}</p>
          </Section>
        )}

        <Section title={t("evidence.sos")}>
          <p className="text-sm text-neutral-600">
            {t(pack.sosEvents.length ? "evidence.sosRange" : "evidence.sosNone", { from: day(pack.window.from), to: day(new Date(new Date(pack.window.to).getTime() - 1).toISOString()) })}
          </p>
          {pack.sosEvents.map((e) => (
            <div key={e.id} className="break-inside-avoid space-y-2 rounded border border-neutral-300 p-4 text-sm">
              <h3 className="font-bold">{t("evidence.alertAt", { time: dateTime(e.createdAt) })}</h3>
              <p>
                {e.lat !== null && e.lng !== null
                  ? t("evidence.location", { coords: coords(e.lat, e.lng), meters: Math.round(e.accuracy ?? 0) })
                  : t("evidence.noLocation")}
                {e.lat !== null && e.lng !== null && <span className="block break-all text-neutral-600">https://maps.google.com/?q={e.lat},{e.lng}</span>}
              </p>
              {e.alerted.length > 0 && (
                <div>
                  <p className="font-semibold">{t("evidence.alerted")}</p>
                  <ul className="list-disc pl-5">
                    {e.alerted.map((d, i) => (
                      <li key={i}>
                        {d.name}: {delivery(d)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {e.responses.length > 0 && (
                <div>
                  <p className="font-semibold">{t("evidence.responses")}</p>
                  <ul className="list-disc pl-5">
                    {e.responses.map((a, i) => (
                      <li key={i}>{a.name ? t("evidence.responded", { name: a.name, time: time(a.at) }) : t("evidence.respondedUnnamed", { time: time(a.at) })}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p>
                {e.recordings.pieces && e.recordings.first && e.recordings.last
                  ? t("evidence.recordings", {
                      count: e.recordings.pieces,
                      from: time(e.recordings.first),
                      to: time(e.recordings.last),
                      size: fileSize(e.recordings.bytes),
                    })
                  : t("evidence.noRecordings")}
              </p>
            </div>
          ))}
        </Section>

        <Section title={t("evidence.letter")}>
          <p className="text-sm text-neutral-600">{t("evidence.letterNote")}</p>
          <pre className="whitespace-pre-wrap rounded border border-neutral-300 p-4 font-sans text-sm leading-relaxed">{letter}</pre>
        </Section>

        <footer className="border-t border-neutral-300 pt-4 text-xs text-neutral-600">
          {t("evidence.footer", { zone: Intl.DateTimeFormat().resolvedOptions().timeZone })}
        </footer>
      </article>
    );
  };

  return (
    <div className="min-h-screen">
      <div className="print:hidden">
        <Navbar />
      </div>
      <main className="px-4 pb-16 pt-24 print:p-0">
        <div className="container mx-auto max-w-3xl space-y-4 print:max-w-none print:p-0">
          <div className="space-y-3 print:hidden">
            <Link to="/account" className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
              <ArrowLeft className="h-4 w-4" /> {t("evidence.back")}
            </Link>
            <h1 className="flex items-center gap-2 text-3xl font-extrabold">
              <FileText className="h-7 w-7 text-primary" /> {t("evidence.title")}
            </h1>
            <p className="text-muted-foreground">{t("evidence.intro")}</p>
            {pack && (
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="hero" className="gap-2" onClick={() => printPage(`HerSpace evidence ${pack.report.id}`).catch(() => {})}>
                  <Printer className="h-4 w-4" /> {t("evidence.save")}
                </Button>
                <Link to={`/complaint?report=${pack.report.id}`} className="text-sm font-semibold text-primary underline underline-offset-2">
                  {t("evidence.editLetter")}
                </Link>
              </div>
            )}
            {pack && <p className="text-xs text-muted-foreground">{t("evidence.saveHint")}</p>}
          </div>
          {body()}
        </div>
      </main>
    </div>
  );
};

export default Evidence;
