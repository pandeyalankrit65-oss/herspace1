import { LocalNotifications } from "@capacitor/local-notifications";
import { format, initialLang } from "@/i18n";
import { readDisguise } from "./disguise";
import { isNative } from "./native";

// Notifications show on the lock screen, where someone checking her phone can read them. With
// disguised mode on, every HerSpace notification says only "Reminder", never what it's about.
export function forLockScreen(text: { title: string; body: string }) {
  if (!readDisguise()?.enabled) return text;
  const lang = initialLang();
  return { title: format(lang, "notify.discreetTitle"), body: format(lang, "notify.discreetBody") };
}

// Turning on disguised mode: notifications scheduled before (a follow-up tomorrow, journey
// reminders, a daily check-in reminder) still carry their old text, so rewrite them, same times.
export async function neutraliseScheduledNotifications() {
  if (!isNative || !readDisguise()?.enabled) return;
  try {
    const { notifications } = await LocalNotifications.getPending();
    if (!notifications.length) return;
    const text = forLockScreen({ title: "", body: "" });
    await LocalNotifications.cancel({ notifications: notifications.map((n) => ({ id: n.id })) });
    await LocalNotifications.schedule({
      notifications: notifications.map((n) => ({ id: n.id, ...text, schedule: n.schedule, extra: n.extra })),
    });
  } catch (err) {
    console.warn("Couldn't hide the text of scheduled notifications:", err);
  }
}
