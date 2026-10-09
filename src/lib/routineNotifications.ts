import { LocalNotifications } from "@capacitor/local-notifications";
import { isNative } from "./native";
import { forLockScreen } from "./lockScreen";
import type { Routine } from "./routines";

// In the Android app, each regular journey becomes weekly system notifications at its time, so
// the reminder comes even when the app is closed. (In the browser, the dashboard shows it.)
const BASE_ID = 20000;

export async function syncRoutineNotifications(routines: Routine[], text: (r: Routine) => { title: string; body: string }) {
  if (!isNative) return;
  try {
    const pending = await LocalNotifications.getPending();
    const ours = pending.notifications.filter((n) => n.id >= BASE_ID && n.id < BASE_ID + 1000);
    if (ours.length) await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) });
    if (routines.length === 0) return;
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== "granted" && (await LocalNotifications.requestPermissions()).display !== "granted") return;
    const notifications = routines.flatMap((r, i) => {
      const [hour, minute] = r.time.split(":").map(Number);
      const { title, body } = forLockScreen(text(r));
      // Capacitor counts weekdays from 1 (Sunday) to 7 (Saturday).
      return r.days.map((day) => ({
        id: BASE_ID + i * 10 + day,
        title,
        body,
        schedule: { on: { weekday: day + 1, hour, minute }, allowWhileIdle: true },
        extra: { path: `/walk?routine=${encodeURIComponent(r.id)}` },
      }));
    });
    await LocalNotifications.schedule({ notifications });
  } catch (err) {
    console.warn("Couldn't schedule the journey reminders:", err);
  }
}
