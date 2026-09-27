import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.herspace",
  appName: "HerSpace",
  webDir: "dist",
  // Matches the app's dark theme, so nothing flashes white while pages load.
  backgroundColor: "#121216",
  android: {
    // Required by background-geolocation: otherwise location updates stop after ~5 minutes
    // in the background.
    useLegacyBridge: true,
  },
  plugins: {
    // Light status/navigation bar icons on the dark app background.
    SystemBars: { style: "DARK" },
    // API calls go through Android's native HTTP stack: no CORS, and they keep working when the
    // app is in the background (the WebView's own requests get throttled after a few minutes).
    CapacitorHttp: { enabled: true },
    // The session cookie lives in the native cookie store and is sent with native requests.
    CapacitorCookies: { enabled: true },
    LocalNotifications: {
      smallIcon: "ic_stat_herspace",
      iconColor: "#A855F7",
    },
  },
};

export default config;
