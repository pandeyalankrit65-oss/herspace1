import { LocalNotifications } from "@capacitor/local-notifications";
import { api } from "./api";
import { isNative } from "./native";

// Quick wipe, for when someone may take her phone: removes everything HerSpace keeps on this
// phone and signs it out. Nothing on the server is touched (her private record, reports and
// contacts are there when she signs in again somewhere safe). Disguised mode and harmless
// preferences stay, so the phone still opens to a calculator.
const KEEP = new Set(["herspace_disguise", "herspace_lang", "herspace_theme", "herspace_quick_exit"]);
const OUTBOX_DB = "herspace";

export function wipeLocalData() {
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith("herspace") && !KEEP.has(key)) localStorage.removeItem(key);
  } catch {
    // storage blocked: nothing kept there either
  }
  try {
    sessionStorage.clear();
  } catch {
    // ignore
  }
}

export async function wipePhone() {
  // Sign out on the server too, but never wait long for it: the wipe must be quick.
  await Promise.race([api("/api/auth/logout", { method: "POST" }).catch(() => {}), new Promise((r) => setTimeout(r, 2000))]);
  wipeLocalData();
  // Reports saved offline and not yet sent.
  try {
    indexedDB.deleteDatabase(OUTBOX_DB);
  } catch {
    // ignore
  }
  if (isNative) {
    await LocalNotifications.getPending()
      .then(({ notifications }) => (notifications.length ? LocalNotifications.cancel({ notifications: notifications.map((n) => ({ id: n.id })) }) : undefined))
      .catch(() => {});
  }
}
