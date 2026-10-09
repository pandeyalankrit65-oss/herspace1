import { LocalNotifications } from "@capacitor/local-notifications";
import { isNative } from "./native";
import { forLockScreen } from "./lockScreen";

const WARN_BEFORE_MS = 2 * 60_000;

// In the Android app, the "2 minutes left" warning is a scheduled system notification, so it
// appears even if the app is closed. (In the browser the timer page shows it while open.)
export async function scheduleTimerWarning(id: number, dueAt: string, title: string, body: string) {
  if (!isNative) return;
  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== "granted" && (await LocalNotifications.requestPermissions()).display !== "granted") return;
    await LocalNotifications.cancel({ notifications: [{ id }] });
    const at = new Date(new Date(dueAt).getTime() - WARN_BEFORE_MS);
    if (at.getTime() <= Date.now()) return;
    await LocalNotifications.schedule({
      notifications: [{ id, ...forLockScreen({ title, body }), schedule: { at, allowWhileIdle: true }, extra: { path: "/timer" } }],
    });
  } catch (err) {
    console.warn("Couldn't schedule the timer notification:", err);
  }
}

export async function cancelTimerWarning(id: number) {
  if (!isNative) return;
  await LocalNotifications.cancel({ notifications: [{ id }] }).catch(() => {});
}

// A notification straight away (Android app only), e.g. a warning while walking with the
// screen off. In the browser the page shows the warning instead.
export async function notifyNow(id: number, title: string, body: string, path: string) {
  if (!isNative) return;
  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== "granted" && (await LocalNotifications.requestPermissions()).display !== "granted") return;
    await LocalNotifications.schedule({
      notifications: [{ id, ...forLockScreen({ title, body }), schedule: { at: new Date(Date.now() + 500), allowWhileIdle: true }, extra: { path } }],
    });
  } catch (err) {
    console.warn("Couldn't show the notification:", err);
  }
}
