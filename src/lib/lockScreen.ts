import { format, initialLang } from "@/i18n";
import { readDisguise } from "./disguise";

// Notifications show on the lock screen, where someone checking her phone can read them. With
// disguised mode on, every HerSpace notification says only "Reminder", never what it's about.
export function forLockScreen(text: { title: string; body: string }) {
  if (!readDisguise()?.enabled) return text;
  const lang = initialLang();
  return { title: format(lang, "notify.discreetTitle"), body: format(lang, "notify.discreetBody") };
}
