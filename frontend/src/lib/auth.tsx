import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { LoginResponse, Session } from "@vaani/shared";
import * as api from "@/lib/api";

const STORAGE_KEY = "vaani.session";

interface Stored {
  token: string;
  expires_at: string;
  session: Session;
}

// localStorage can be unavailable (private window, blocked site data), so every
// access is guarded and the app just asks for a sign-in each time in that case.
function readStored(): Stored | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as Stored;
    return new Date(stored.expires_at).getTime() > Date.now() ? stored : null;
  } catch {
    return null;
  }
}

function writeStored(stored: Stored | null): void {
  try {
    if (stored) localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to do: the session just won't survive a reload */
  }
}

interface AuthValue {
  session: Session | null;
  // True until the stored sign-in has been checked with the server.
  checking: boolean;
  signIn: (username: string, password: string) => Promise<Session>;
  // Signs in as the judge from the key in the private link.
  signInWithJudgeLink: (key: string) => Promise<Session>;
  signOut: () => void;
  // Re-reads the account's usage (after locking a script or rendering).
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useState<Stored | null>(() => readStored());
  const [checking, setChecking] = useState(() => readStored() !== null);

  const apply = useCallback((next: Stored | null) => {
    api.setToken(next?.token ?? null);
    writeStored(next);
    setStored(next);
  }, []);

  // Restore a sign-in from a previous visit, and confirm the server still accepts it.
  useEffect(() => {
    const existing = readStored();
    api.setToken(existing?.token ?? null);
    if (!existing) return;
    api
      .me()
      .then((session) => apply({ ...existing, session }))
      .catch(() => apply(null))
      .finally(() => setChecking(false));
  }, [apply]);

  // Any call the server answers with "please sign in" ends the session here.
  useEffect(() => {
    const onUnauthorized = () => apply(null);
    window.addEventListener(api.UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(api.UNAUTHORIZED_EVENT, onUnauthorized);
  }, [apply]);

  const signIn = useCallback(
    async (username: string, password: string) => {
      const response: LoginResponse = await api.login(username, password);
      const { token, expires_at, ...session } = response;
      apply({ token, expires_at, session });
      return session;
    },
    [apply],
  );

  const signInWithJudgeLink = useCallback(
    async (key: string) => {
      const { token, expires_at, ...session } = await api.judgeLink(key);
      apply({ token, expires_at, session });
      return session;
    },
    [apply],
  );

  const signOut = useCallback(() => apply(null), [apply]);

  const refresh = useCallback(async () => {
    const current = readStored();
    if (!current) return;
    const session = await api.me().catch(() => null);
    if (session) apply({ ...current, session });
  }, [apply]);

  const value = useMemo(
    () => ({ session: stored?.session ?? null, checking, signIn, signInWithJudgeLink, signOut, refresh }),
    [stored, checking, signIn, signInWithJudgeLink, signOut, refresh],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
