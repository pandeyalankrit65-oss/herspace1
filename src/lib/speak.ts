import { TextToSpeech } from "@capacitor-community/text-to-speech";
import { isNative } from "./native";

// Speaks with the phone's own voice. Android's WebView has no speechSynthesis, so the app uses
// the native text-to-speech engine; browsers use the Web Speech API.
export const canSpeak = isNative || (typeof window !== "undefined" && "speechSynthesis" in window);

// Resolves when it finishes or is stopped; rejects if the phone can't speak (no voice for the
// language, no engine).
export async function speak(text: string, lang: string, rate = 1): Promise<void> {
  if (isNative) {
    await TextToSpeech.stop().catch(() => {});
    await TextToSpeech.speak({ text, lang, rate, category: "playback" });
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = rate;
    u.onend = () => resolve();
    u.onerror = (e) => (e.error === "interrupted" || e.error === "canceled" ? resolve() : reject(new Error(e.error)));
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  });
}

export function stopSpeaking() {
  if (isNative) TextToSpeech.stop().catch(() => {});
  else if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}
