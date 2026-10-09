import { LocalNotifications } from "@capacitor/local-notifications";
import { isNative } from "./native";
import { forLockScreen } from "./lockScreen";
import { readFollowUps, scheduleFollowUp, type FollowUpKind } from "./followUp";

// In the Android app each follow-up is also a notification at its time, so it comes even when
// the app is closed. The text is deliberately vague: the lock screen may be seen by others.
const BASE_ID = 30000;

export type FollowUpText = { title: string; body: string };

export async function syncFollowUpNotifications(text: FollowUpText) {
  if (!isNative) return;
  try {
    const pending = await LocalNotifications.getPending();
    const ours = pending.notifications.filter((n) => n.id >= BASE_ID && n.id < BASE_ID + 100);
    if (ours.length) await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) });
    const list = readFollowUps().filter((f) => f.dueAt > Date.now());
    if (list.length === 0) return;
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== "granted" && (await LocalNotifications.requestPermissions()).display !== "granted") return;
    await LocalNotifications.schedule({
      notifications: list.map((f, i) => ({
        id: BASE_ID + i,
        ...forLockScreen(text),
        schedule: { at: new Date(f.dueAt), allowWhileIdle: true },
        extra: { path: "/" },
      })),
    });
  } catch (err) {
    console.warn("Couldn't schedule the follow-up reminder:", err);
  }
}

export function followUpAfter(kind: FollowUpKind, text: FollowUpText) {
  scheduleFollowUp(kind);
  void syncFollowUpNotifications(text);
}
