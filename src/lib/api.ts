// The session lives in an HttpOnly cookie set by the server, so page scripts never see it.
// Every request carries X-Requested-With, which the server requires on state-changing
// requests to block cross-site request forgery.

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { "X-Requested-With": "HerSpace" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(path, {
      method: options.method || (options.body !== undefined ? "POST" : "GET"),
      headers,
      credentials: "same-origin",
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError("Can't reach the HerSpace server. Check your connection.", 0);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data?.error || `Request failed (${res.status})`, res.status);
  return data as T;
}

export const EMERGENCY_NUMBER = import.meta.env.VITE_EMERGENCY_NUMBER || "112";
