import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { speechLocale, useI18n } from "@/i18n";
import { canSpeak, speak, stopSpeaking } from "@/lib/speak";

// Reads text aloud with the phone's own voice, for people who find reading hard.
const ReadAloud = ({ text }: { text: string }) => {
  const { t, lang } = useI18n();
  const [speaking, setSpeaking] = useState(false);
  // Some devices have speech but no voice installed; then speaking fails at once. Hide the
  // button rather than offer something that silently does nothing.
  const [failed, setFailed] = useState(false);
  // Only the latest reading may update the button (stopping one finishes it late).
  const current = useRef(0);

  useEffect(() => () => {
    if (canSpeak) stopSpeaking();
  }, []);

  if (!canSpeak || failed) return null;

  const toggle = () => {
    const id = ++current.current;
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    speak(text, speechLocale(lang), 0.95).then(
      () => id === current.current && setSpeaking(false),
      () => {
        if (id !== current.current) return;
        setSpeaking(false);
        setFailed(true);
      }
    );
  };

  return (
    <button type="button" onClick={toggle} aria-pressed={speaking} className="inline-flex items-center gap-1.5 font-semibold text-primary underline-offset-2 hover:underline">
      {speaking ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      {speaking ? t("sos.stopReading") : t("sos.readAloud")}
    </button>
  );
};

export default ReadAloud;
