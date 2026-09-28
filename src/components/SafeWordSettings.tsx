import { useEffect, useRef, useState } from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { speechLocale, useI18n } from "@/i18n";
import { canListen, listenOnce, type Listening } from "@/lib/listen";
import { countWord, SAFE_WORD_REPEATS, type SafeWordSettings as Settings } from "@/lib/safe-word";

// Set, test and remove the personal safe word used by the voice trigger.
const SafeWordSettings = ({ settings, onSave }: { settings: Settings; onSave: (next: Settings) => void }) => {
  const { t, lang } = useI18n();
  const [editing, setEditing] = useState(false);
  const [word, setWord] = useState(settings.word ?? "");
  const [helpWords, setHelpWords] = useState(settings.helpWords);
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<{ heard: string; count: number } | null>(null);
  const session = useRef<Listening | null>(null);

  useEffect(() => () => session.current?.stop(), []);
  if (!canListen()) return null;

  const valid = word.trim().length >= 3;

  const runTest = () => {
    if (!valid) return;
    setTest(null);
    setTesting(true);
    const s = listenOnce(speechLocale(lang));
    session.current = s;
    s.result
      .then((heard) => setTest({ heard: heard[0] ?? "", count: Math.max(0, ...heard.map((h) => countWord(h, word))) }))
      .catch(() => setTest({ heard: "", count: 0 }))
      .finally(() => setTesting(false));
  };

  if (!editing) {
    return (
      <div className="mx-auto flex max-w-md items-start gap-3 rounded-xl border bg-muted/40 p-3 text-left">
        <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{t("safeWord.title")}</p>
          <p className="text-xs text-muted-foreground">
            {settings.word ? t("safeWord.current", { word: settings.word, count: SAFE_WORD_REPEATS }) : t("safeWord.intro", { count: SAFE_WORD_REPEATS })}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
          {settings.word ? t("safeWord.change") : t("safeWord.set")}
        </Button>
      </div>
    );
  }

  return (
    <form
      className="mx-auto max-w-md space-y-3 rounded-xl border bg-muted/40 p-4 text-left"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        onSave({ word: word.trim(), helpWords });
        setEditing(false);
        setTest(null);
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="safe-word">{t("safeWord.title")}</Label>
        <Input id="safe-word" value={word} maxLength={30} autoComplete="off" placeholder={t("safeWord.placeholder")} onChange={(e) => setWord(e.target.value)} />
        <p className="text-xs text-muted-foreground">{t("safeWord.tip", { count: SAFE_WORD_REPEATS })}</p>
      </div>

      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <label htmlFor="help-words" className="text-sm font-semibold">
            {t("safeWord.helpWords")}
          </label>
          <p className="text-xs text-muted-foreground">{t("safeWord.helpWordsHint")}</p>
        </div>
        <Switch id="help-words" checked={helpWords} onCheckedChange={setHelpWords} />
      </div>

      <div className="space-y-1">
        <Button type="button" variant="outline" size="sm" disabled={!valid || testing} onClick={runTest}>
          {testing ? t("safeWord.testing", { count: SAFE_WORD_REPEATS }) : t("safeWord.test")}
        </Button>
        {test && (
          <p role="status" className={`text-sm ${test.count >= SAFE_WORD_REPEATS ? "text-success" : ""}`}>
            {test.heard ? t("sos.voiceHeard", { text: test.heard }) : t("vc.nothing")}{" "}
            {test.heard &&
              (test.count >= SAFE_WORD_REPEATS
                ? t("safeWord.testOk")
                : t("safeWord.testCount", { heard: test.count, count: SAFE_WORD_REPEATS }))}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="hero" size="sm" disabled={!valid}>
          {t("safeWord.save")}
        </Button>
        {settings.word && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onSave({ word: null, helpWords: true });
              setWord("");
              setHelpWords(true);
              setEditing(false);
            }}
          >
            {t("safeWord.remove")}
          </Button>
        )}
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
          {t("common.cancel")}
        </Button>
      </div>
    </form>
  );
};

export default SafeWordSettings;
