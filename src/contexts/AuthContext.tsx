import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { api, ApiError, getToken, setToken } from "@/lib/api";
import { clearOfflineData, offlineUser } from "@/lib/offline";

export type User = { id: number; name: string; email: string };

type AuthResponse = { token: string; user: User };

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  // For flows that return a fresh session themselves (password reset/change).
  setSession: (token: string, user?: User) => void;
  clearSession: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(() => Boolean(getToken()));

  // Sets the signed-in user and keeps a copy on the device for offline SOS.
  const remember = useCallback((next: User) => {
    const previous = offlineUser.get<User>();
    if (previous && previous.id !== next.id) clearOfflineData();
    offlineUser.set(next);
    setUser(next);
  }, []);

  const forget = useCallback(() => {
    setToken(null);
    clearOfflineData();
    setUser(null);
  }, []);

  useEffect(() => {
    // The pre-auth prototype kept a fake "logged in" user here; it no longer means anything.
    try {
      localStorage.removeItem("herspace_user");
    } catch {
      // ignore
    }
    if (!getToken()) return;
    api<{ user: User }>("/api/auth/me")
      .then(({ user }) => remember(user))
      .catch((err) => {
        // Only sign out when the server rejected the token. On network errors (offline),
        // carry on as the last-known user so SOS can still offer their contacts.
        if (err instanceof ApiError && err.status === 401) forget();
        else setUser(offlineUser.get<User>());
      })
      .finally(() => setLoading(false));
  }, [remember, forget]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api<AuthResponse>("/api/auth/login", { body: { email, password } });
    setToken(res.token);
    remember(res.user);
  }, [remember]);

  const signup = useCallback(async (name: string, email: string, password: string) => {
    const res = await api<AuthResponse>("/api/auth/signup", { body: { name, email, password } });
    setToken(res.token);
    remember(res.user);
  }, [remember]);

  const logout = useCallback(async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    forget();
  }, [forget]);

  const setSession = useCallback(
    (token: string, newUser?: User) => {
      setToken(token);
      if (newUser) remember(newUser);
    },
    [remember]
  );

  const clearSession = forget;

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, setSession, clearSession }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
