import { LocalNotifications, type Schedule, type ScheduleOn } from "@capacitor/local-notifications";
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

// What Android reports for a pending notification, as something it accepts back. Its one-off
// times come back as text like "Sun Oct 11 10:00:00 GMT+05:30 2026", which the plugin refuses,
// so they're turned into dates; past ones are left alone (rescheduling would fire them now).
export function rescheduleFor(schedule: { at?: string | Date; on?: ScheduleOn } | undefined, now = Date.now()): Schedule | null {
  if (schedule?.on) return { on: schedule.on, allowWhileIdle: true };
  if (!schedule?.at) return null;
  const at = new Date(schedule.at);
  return Number.isNaN(at.getTime()) || at.getTime() <= now ? null : { at, allowWhileIdle: true };
}

// Turning on disguised mode: notifications scheduled before (a follow-up tomorrow, journey
// reminders, a daily check-in reminder) still carry their old text, so rewrite them, same times.
// Each is replaced in place under its own id, never cancelled first: if one can't be rewritten,
// it stays as it was rather than disappearing.
export async function neutraliseScheduledNotifications() {
  if (!isNative || !readDisguise()?.enabled) return;
  const text = forLockScreen({ title: "", body: "" });
  try {
    const { notifications } = await LocalNotifications.getPending();
    for (const n of notifications) {
      // Typed as a Date, but Android hands back text.
      const schedule = rescheduleFor(n.schedule as { at?: string | Date; on?: ScheduleOn } | undefined);
      if (!schedule) continue;
      await LocalNotifications.schedule({ notifications: [{ id: n.id, ...text, schedule, extra: n.extra }] }).catch((err) =>
        console.warn(`Couldn't hide the text of notification ${n.id}:`, err)
      );
    }
  } catch (err) {
    console.warn("Couldn't hide the text of scheduled notifications:", err);
  }
}
