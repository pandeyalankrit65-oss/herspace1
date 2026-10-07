import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { deleteJournal } from "@/lib/mood";
import { syncRoutineNotifications } from "@/lib/routineNotifications";
import { clearOfflineData, offlineUser } from "@/lib/offline";

export type User = {
  id: number;
  name: string;
  email: string;
  moderator?: boolean;
  phone?: string | null;
  emailVerified?: boolean;
  // Paused from the Safe Map by a moderator; SOS and everything else still work.
  mapSuspended?: boolean;
};

type AuthResponse = { user: User };

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  // For flows where the server has already started a session (password reset).
  signedIn: (user: User) => void;
  // For flows where the server has already ended it (account deletion).
  clearSession: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Sets the signed-in user and keeps a copy on the device for offline SOS.
  const signedIn = useCallback((next: User) => {
    const previous = offlineUser.get<User>();
    if (previous && previous.id !== next.id) {
      clearOfflineData();
      // Someone else signing in on this phone: the journal belonged to the previous person.
      deleteJournal();
    }
    offlineUser.set(next);
    setUser(next);
  }, []);

  const clearSession = useCallback(() => {
    clearOfflineData();
    setUser(null);
  }, []);

  useEffect(() => {
    // Earlier versions kept a fake user and then a session token in localStorage.
    try {
      localStorage.removeItem("herspace_user");
      localStorage.removeItem("herspace_token");
    } catch {
      // ignore
    }
    // The session cookie is invisible to scripts, so ask the server who we are.
    api<{ user: User }>("/api/auth/me")
      .then(({ user }) => signedIn(user))
      .catch((err) => {
        // Only sign out when the server says so. On network errors (offline), carry on as the
        // last-known user so SOS can still offer their contacts.
        if (err instanceof ApiError && err.status === 401) clearSession();
        else setUser(offlineUser.get<User>());
      })
      .finally(() => setLoading(false));
  }, [signedIn, clearSession]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api<AuthResponse>("/api/auth/login", { body: { email, password } });
      signedIn(res.user);
    },
    [signedIn]
  );

  const signup = useCallback(
    async (name: string, email: string, password: string) => {
      const res = await api<AuthResponse>("/api/auth/signup", { body: { name, email, password } });
      signedIn(res.user);
    },
    [signedIn]
  );

  const logout = useCallback(async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    // Only on a real logout: clearSession also runs for every signed-out visit, and must not
    // erase a journal kept by someone who never signed in.
    deleteJournal();
    // Routines go with the other on-device data; their phone reminders go too.
    void syncRoutineNotifications([], () => ({ title: "", body: "" }));
    clearSession();
  }, [clearSession]);

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, signedIn, clearSession }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
