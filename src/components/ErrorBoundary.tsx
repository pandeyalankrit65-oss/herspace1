import { Component, ErrorInfo, ReactNode } from "react";
import { EMERGENCY_NUMBER } from "@/lib/api";
import { format, initialLang } from "@/i18n";

type State = { error: Error | null };

// Last line of defence: even if a page crashes, keep a way to call for help on screen.
class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled UI error:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    // Rendered outside the i18n provider (which may be what crashed), so read the language directly.
    const lang = initialLang();
    const t = (key: Parameters<typeof format>[1], vars?: Record<string, string>) => format(lang, key, vars);
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold">{navigator.onLine ? t("error.title") : t("error.offlineTitle")}</h1>
          <p className="text-muted-foreground">{navigator.onLine ? t("error.desc") : t("error.offlineDesc")}</p>
          <div className="flex flex-col gap-2">
            <a
              href={`tel:${EMERGENCY_NUMBER}`}
              className="rounded-md bg-destructive px-4 py-3 font-semibold text-destructive-foreground"
            >
              {t("common.call", { number: EMERGENCY_NUMBER })}
            </a>
            <a href="/sos" className="rounded-md border px-4 py-3">
              {t("error.openSos")}
            </a>
            <button className="text-sm text-muted-foreground underline" onClick={() => window.location.reload()}>
              {t("error.reload")}
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
