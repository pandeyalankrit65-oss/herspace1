import { apiUrl } from "./native";
import { reportReachable } from "./offline";

// The session lives in an HttpOnly cookie set by the server, so page scripts never see it.
// Every request carries X-Requested-With, which the server requires on state-changing
// requests to block cross-site request forgery.

export class ApiError extends Error {
  constructor(message: string, public status: number, public data?: Record<string, unknown>) {
    super(message);
  }
}

export async function api<T>(path: string, options: { method?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<T> {
  const headers: Record<string, string> = { "X-Requested-With": "HerSpace", ...options.headers };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(apiUrl(path), {
      method: options.method || (options.body !== undefined ? "POST" : "GET"),
      headers,
      credentials: "same-origin",
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    reportReachable(false);
    throw new ApiError("Can't reach the HerSpace server. Check your connection.", 0);
  }
  reportReachable(true);

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data?.error || `Request failed (${res.status})`, res.status, data);
  return data as T;
}

export const EMERGENCY_NUMBER = import.meta.env.VITE_EMERGENCY_NUMBER || "112";
