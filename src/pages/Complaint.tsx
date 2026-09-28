import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Copy, FileSignature, Mail, Printer } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import { buildComplaint, type ComplaintFields, type ComplaintKind } from "@/content/complaint";

type Report = { id: number; description: string; location: string | null; date: string | null; createdAt: string; photos?: number[] };

// Writes a formal complaint (police FIR request or workplace POSH complaint) from the user's
// details, optionally starting from one of their saved reports. Nothing here is sent anywhere.
const Complaint = () => {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const l = lang === "hi" ? "hi" : "en";
  const [fields, setFields] = useState<ComplaintFields>({
    kind: "police",
    to: "",
    name: "",
    phone: "",
    address: "",
    date: "",
    place: "",
    description: "",
    accused: "",
    witnesses: "",
    attachments: 0,
  });
  const [edited, setEdited] = useState<string | null>(null);

  useEffect(() => {
    if (user) setFields((f) => ({ ...f, name: f.name || user.name, phone: f.phone || user.phone || "" }));
  }, [user]);

  // Start from a saved report.
  const reportId = Number(params.get("report"));
  useEffect(() => {
    if (!reportId || !user) return;
    api<{ reports: Report[] }>("/api/reports")
      .then(({ reports }) => {
        const r = reports.find((x) => x.id === reportId);
        if (!r) return;
        setFields((f) => ({
          ...f,
          description: r.description,
          place: r.location ?? f.place,
          date: r.date ?? r.createdAt.slice(0, 10),
          attachments: r.photos?.length ?? 0,
        }));
      })
      .catch(() => {});
  }, [reportId, user]);

  const generated = useMemo(() => buildComplaint(fields, l), [fields, l]);
  const letter = edited ?? generated;
  const set = (key: keyof ComplaintFields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setEdited(null);
    setFields((f) => ({ ...f, [key]: e.target.value }));
  };

  const copy = () => navigator.clipboard.writeText(letter).then(() => toast({ title: t("common.copied") }));
  const print = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.title = t("complaint.title");
    const pre = w.document.createElement("pre");
    pre.textContent = letter;
    pre.style.cssText = "white-space:pre-wrap;font:16px/1.6 system-ui,sans-serif;margin:40px";
    w.document.body.appendChild(pre);
    w.print();
  };
  const subject = letter.split("\n").find((line) => /^(Subject|विषय):/.test(line))?.replace(/^(Subject|विषय):\s*/, "") ?? t("complaint.title");
  const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(letter)}`;

  const field = (key: keyof ComplaintFields, label: string, opts: { type?: string; textarea?: boolean; placeholder?: string } = {}) => (
    <div className="space-y-1">
      <Label htmlFor={`c-${key}`}>{label}</Label>
      {opts.textarea ? (
        <Textarea id={`c-${key}`} rows={4} value={String(fields[key])} onChange={set(key)} placeholder={opts.placeholder} />
      ) : (
        <Input id={`c-${key}`} type={opts.type ?? "text"} value={String(fields[key])} onChange={set(key)} placeholder={opts.placeholder} />
      )}
    </div>
  );

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="px-4 pb-16 pt-24">
        <div className="container mx-auto max-w-5xl space-y-6">
          <PageHeader icon={FileSignature} title={t("complaint.title")} subtitle={t("complaint.intro")} />

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardContent className="space-y-4 pt-6">
                <fieldset>
                  <legend className="mb-2 text-sm font-semibold">{t("complaint.kind")}</legend>
                  <div className="grid grid-cols-2 gap-2" role="radiogroup">
                    {(["police", "workplace"] as ComplaintKind[]).map((k) => (
                      <button
                        key={k}
                        type="button"
                        role="radio"
                        aria-checked={fields.kind === k}
                        onClick={() => {
                          setEdited(null);
                          setFields((f) => ({ ...f, kind: k }));
                        }}
                        className={`rounded-lg border px-3 py-2 text-sm transition-colors ${fields.kind === k ? "border-primary bg-primary/10 font-semibold" : "text-muted-foreground hover:bg-muted"}`}
                      >
                        {k === "police" ? t("complaint.police") : t("complaint.workplace")}
                      </button>
                    ))}
                  </div>
                </fieldset>
                {field("to", fields.kind === "police" ? t("complaint.station") : t("complaint.organisation"))}
                <div className="grid gap-4 sm:grid-cols-2">
                  {field("name", t("complaint.name"))}
                  {field("phone", t("complaint.phone"), { type: "tel" })}
                </div>
                {field("address", t("complaint.address"))}
                <div className="grid gap-4 sm:grid-cols-2">
                  {field("date", t("complaint.date"), { type: "date" })}
                  {field("place", t("complaint.place"))}
                </div>
                {field("description", t("complaint.description"), { textarea: true })}
                {field("accused", t("complaint.accused"), { placeholder: t("complaint.optional") })}
                {field("witnesses", t("complaint.witnesses"), { placeholder: t("complaint.optional") })}
              </CardContent>
            </Card>

            <div className="space-y-3">
              <Label htmlFor="complaint-letter" className="text-base font-bold">
                {t("complaint.letter")}
              </Label>
              <Textarea
                id="complaint-letter"
                value={letter}
                onChange={(e) => setEdited(e.target.value)}
                className="min-h-[28rem] font-mono text-sm leading-relaxed"
              />
              <div className="flex flex-wrap gap-2">
                <Button variant="hero" className="gap-2" onClick={copy}>
                  <Copy className="h-4 w-4" /> {t("common.copy")}
                </Button>
                <Button variant="outline" className="gap-2" onClick={print}>
                  <Printer className="h-4 w-4" /> {t("complaint.print")}
                </Button>
                <a href={mailto}>
                  <Button variant="outline" className="gap-2">
                    <Mail className="h-4 w-4" /> {t("complaint.email")}
                  </Button>
                </a>
              </div>
              <p className="text-sm text-muted-foreground">
                {t("complaint.note")}{" "}
                <Link to="/help#police" className="font-semibold text-primary underline underline-offset-2">
                  {t("complaint.rights")}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Complaint;
