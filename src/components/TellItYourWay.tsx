import { useRef, useState } from "react";
import { Mic, MicOff, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { canListen, listenOnce, type Listening } from "@/lib/listen";
import { speechLocale, useI18n } from "@/i18n";

export type ReportDraft = {
  incidentType: "harassment" | "assault" | "stalking" | "threat" | "discrimination" | "other";
  description: string;
  location: string;
  date: string;
  time: string;
};

// "Tell it in your own words": she says or types what happened, at her own pace, and gets a
// draft report in the form below to check and change. Nothing is sent until she submits it.
const TellItYourWay = ({ onDraft }: { onDraft: (draft: ReportDraft, byAi: boolean) => void }) => {
  const { t, lang } = useI18n();
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<"" | "tell.doneAi" | "tell.doneWords" | "tell.failed">("");
  const session = useRef<Listening | null>(null);
  // What she'd said before this passage, so each passage adds to it.
  const before = useRef("");

  const toggleListening = () => {
    if (listening) {
      session.current?.stop();
      setListening(false);
      return;
    }
    before.current = text.trim();
    const join = (more: string) => [before.current, more].filter(Boolean).join(" ");
    setListening(true);
    const s = listenOnce(speechLocale(lang), (partial) => setText(join(partial)));
    session.current = s;
    s.result
      .then((heard) => session.current === s && heard[0] && setText(join(heard[0])))
      .catch(() => {})
      .finally(() => session.current === s && setListening(false));
  };

  const makeDraft = async () => {
    session.current?.stop();
    setListening(false);
    setBusy(true);
    setDone("");
    try {
      const res = await api<{ draft: ReportDraft; mode: "ai" | "fallback" }>("/api/reports/draft", {
        body: { text: text.trim(), today: new Date().toLocaleDateString("en-CA"), lang },
      });
      onDraft(res.draft, res.mode === "ai");
      setDone(res.mode === "ai" ? "tell.doneAi" : "tell.doneWords");
    } catch {
      onDraft({ incidentType: "other", description: text.trim(), location: "", date: "", time: "" }, false);
      setDone("tell.failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" /> {t("tell.title")}
        </CardTitle>
        <CardDescription>{t("tell.desc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Label htmlFor="tell-text" className="sr-only">
          {t("tell.title")}
        </Label>
        <Textarea
          id="tell-text"
          className="min-h-32"
          placeholder={t("tell.placeholder")}
          value={text}
          maxLength={5000}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          {canListen() && (
            <Button type="button" variant={listening ? "hero" : "outline"} className="gap-2" aria-pressed={listening} onClick={toggleListening}>
              {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />} {listening ? t("tell.stopSpeaking") : t("tell.speak")}
            </Button>
          )}
          <Button type="button" variant="hero" onClick={makeDraft} disabled={busy || text.trim().length < 10}>
            {busy ? t("tell.making") : t("tell.make")}
          </Button>
        </div>
        {done && (
          <p role="status" className="rounded-lg bg-primary/5 p-3 text-sm font-medium">
            {t(done)}
          </p>
        )}
        <p className="text-xs text-muted-foreground">{t("tell.privacy")}</p>
      </CardContent>
    </Card>
  );
};

export default TellItYourWay;
