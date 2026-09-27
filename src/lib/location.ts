import { registerPlugin } from "@capacitor/core";
import { isNative } from "./native";

export type Position = { lat: number; lng: number; accuracy: number };
export type LocationError = "denied" | "unavailable";

type NativeLocation = { latitude: number; longitude: number; accuracy: number };
type BackgroundGeolocationPlugin = {
  addWatcher(
    options: {
      backgroundMessage?: string;
      backgroundTitle?: string;
      requestPermissions?: boolean;
      stale?: boolean;
      distanceFilter?: number;
    },
    callback: (location?: NativeLocation, error?: { code?: string; message?: string }) => void
  ): Promise<string>;
  removeWatcher(options: { id: string }): Promise<void>;
  openSettings(): Promise<void>;
};

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>("BackgroundGeolocation");

// Native watchers outlive a WebView reload, but the JavaScript that would remove them doesn't:
// without cleanup, a reload leaves the location notification (and GPS) running forever. Their
// IDs are kept on the device, and anything left from before a reload is removed at startup;
// screens that still need location start a fresh watcher.
const WATCHERS_KEY = "herspace_bg_watchers";
const storedWatchers = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(WATCHERS_KEY) || "[]");
  } catch {
    return [];
  }
};
const storeWatchers = (ids: string[]) => {
  try {
    localStorage.setItem(WATCHERS_KEY, JSON.stringify(ids));
  } catch {
    // ignore
  }
};
const orphansRemoved: Promise<void> = isNative
  ? Promise.all(storedWatchers().map((id) => BackgroundGeolocation.removeWatcher({ id }).catch(() => {}))).then(() =>
      storeWatchers([])
    )
  : Promise.resolve();

/**
 * Watches the device's position until the returned function is called.
 *
 * With `background` set, the Android app keeps receiving updates while the screen is locked or
 * the user switches apps, showing a persistent notification (Android requires one). In a
 * browser this falls back to the normal watch, which pauses when the page is hidden.
 */
export function watchLocation(
  onPosition: (pos: Position) => void,
  onError: (err: LocationError) => void,
  background?: { title: string; message: string }
): () => void {
  if (isNative && background) {
    let id: string | undefined;
    let stopped = false;
    orphansRemoved
      .then(() =>
        BackgroundGeolocation.addWatcher(
          { backgroundTitle: background.title, backgroundMessage: background.message, requestPermissions: true, stale: false, distanceFilter: 20 },
          (location, error) => {
            if (error) return onError(error.code === "NOT_AUTHORIZED" ? "denied" : "unavailable");
            if (location) onPosition({ lat: location.latitude, lng: location.longitude, accuracy: location.accuracy });
          }
        )
      )
      .then((watcherId) => {
        id = watcherId;
        storeWatchers([...storedWatchers(), watcherId]);
        if (stopped) remove(watcherId);
      })
      .catch(() => onError("unavailable"));
    const remove = (watcherId: string) => {
      storeWatchers(storedWatchers().filter((w) => w !== watcherId));
      BackgroundGeolocation.removeWatcher({ id: watcherId }).catch(() => {});
    };
    return () => {
      stopped = true;
      if (id) remove(id);
    };
  }

  if (!navigator.geolocation) {
    onError("unavailable");
    return () => {};
  }
  const watch = navigator.geolocation.watchPosition(
    (pos) => onPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
    (err) => onError(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable"),
    { enableHighAccuracy: true, maximumAge: 10_000 }
  );
  return () => navigator.geolocation.clearWatch(watch);
}
