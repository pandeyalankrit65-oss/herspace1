import { Component, ErrorInfo, ReactNode } from "react";
import { EMERGENCY_NUMBER } from "@/lib/api";

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
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="text-muted-foreground">This page hit an error. If you're in danger, call for help now.</p>
          <div className="flex flex-col gap-2">
            <a
              href={`tel:${EMERGENCY_NUMBER}`}
              className="rounded-md bg-destructive px-4 py-3 font-semibold text-destructive-foreground"
            >
              Call {EMERGENCY_NUMBER}
            </a>
            <a href="/sos" className="rounded-md border px-4 py-3">
              Open SOS page
            </a>
            <button className="text-sm text-muted-foreground underline" onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
