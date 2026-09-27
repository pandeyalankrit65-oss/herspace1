import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { App } from "@capacitor/app";
import { LocalNotifications } from "@capacitor/local-notifications";
import { isNative } from "@/lib/native";

// Connects Android app events to the router. Renders nothing; does nothing in a browser.
const NativeBridge = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isNative) return;
    const handles = [
      // App shortcut ("Emergency SOS" on long-press) and herspace:// links: herspace://sos -> /sos
      App.addListener("appUrlOpen", ({ url }) => {
        try {
          const u = new URL(url);
          const path = u.protocol === "herspace:" ? `/${u.host}${u.pathname}` : u.pathname;
          navigate(path.replace(/\/+$/, "") || "/");
        } catch {
          // ignore malformed links
        }
      }),
      // Tapping the safety-timer notification opens the timer.
      LocalNotifications.addListener("localNotificationActionPerformed", ({ notification }) => {
        const path = (notification.extra as { path?: string } | undefined)?.path;
        if (path) navigate(path);
      }),
    ];
    return () => handles.forEach((h) => h.then((l) => l.remove()));
  }, [navigate]);

  // Android back button: go back in the app, and only leave it from the home page.
  useEffect(() => {
    if (!isNative) return;
    const handle = App.addListener("backButton", ({ canGoBack }) => {
      if (location.pathname === "/" || !canGoBack) App.exitApp();
      else window.history.back();
    });
    return () => {
      handle.then((l) => l.remove());
    };
  }, [location.pathname]);

  return null;
};

export default NativeBridge;
