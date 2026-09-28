import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { speechLocale, useI18n } from "@/i18n";

// Reads text aloud with the phone's own voice, for people who find reading hard.
const ReadAloud = ({ text }: { text: string }) => {
  const { t, lang } = useI18n();
  const [speaking, setSpeaking] = useState(false);
  // Some devices have the API but no voice installed; then speaking fails at once. Hide the
  // button rather than offer something that silently does nothing.
  const [failed, setFailed] = useState(false);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window && !failed;

  useEffect(() => () => {
    if (supported) window.speechSynthesis.cancel();
  }, [supported]);

  if (!supported) return null;

  const toggle = () => {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = speechLocale(lang);
    u.rate = 0.95;
    u.onend = () => setSpeaking(false);
    u.onerror = (e) => {
      setSpeaking(false);
      if (e.error !== "interrupted" && e.error !== "canceled") setFailed(true);
    };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    setSpeaking(true);
  };

  return (
    <button type="button" onClick={toggle} aria-pressed={speaking} className="inline-flex items-center gap-1.5 font-semibold text-primary underline-offset-2 hover:underline">
      {speaking ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      {speaking ? t("sos.stopReading") : t("sos.readAloud")}
    </button>
  );
};

export default ReadAloud;
