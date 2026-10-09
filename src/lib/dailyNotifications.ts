import { LocalNotifications } from "@capacitor/local-notifications";
import { isNative } from "./native";
import { forLockScreen } from "./lockScreen";

// Android: a reminder every day, half an hour before her daily check-in deadline.
const ID = 31000;

export async function syncDailyReminder(deadline: string | null, text: { title: string; body: string }) {
  if (!isNative) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: ID }] });
    if (!deadline) return;
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== "granted" && (await LocalNotifications.requestPermissions()).display !== "granted") return;
    const [h, m] = deadline.split(":").map(Number);
    const minutes = (h * 60 + m - 30 + 24 * 60) % (24 * 60);
    await LocalNotifications.schedule({
      notifications: [
        { id: ID, ...forLockScreen(text), schedule: { on: { hour: Math.floor(minutes / 60), minute: minutes % 60 }, allowWhileIdle: true }, extra: { path: "/" } },
      ],
    });
  } catch (err) {
    console.warn("Couldn't schedule the daily check-in reminder:", err);
  }
}
