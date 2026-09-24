import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";

import { api, loadToken, setToken, User } from "@/src/api";

WebBrowser.maybeCompleteAuthSession();

type AuthState = {
  user: User | null;
  loading: boolean;
  signingIn: boolean;
  authError: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

function extractSessionId(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/[?#&]session_id=([^&#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const processed = useRef<Set<string>>(new Set());

  const handleSessionId = useCallback(async (sessionId: string) => {
    if (processed.current.has(sessionId)) return;
    processed.current.add(sessionId);
    setSigningIn(true);
    setAuthError(null);
    try {
      const res = await api.authSession(sessionId);
      await setToken(res.session_token);
      setUser(res.user);
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.history.replaceState(window.history.state, "", window.location.pathname);
      }
    } catch (e: any) {
      setAuthError(e?.message || "Sign in failed. Please try again.");
    } finally {
      setSigningIn(false);
    }
  }, []);

  // Bootstrap: existing session + any session_id already in the URL.
  useEffect(() => {
    (async () => {
      // Web: process session_id from URL first.
      if (Platform.OS === "web" && typeof window !== "undefined") {
        const sid = extractSessionId(window.location.hash) || extractSessionId(window.location.search);
        if (sid) {
          await handleSessionId(sid);
          setLoading(false);
          return;
        }
      } else {
        const initial = await Linking.getInitialURL();
        const sid = extractSessionId(initial);
        if (sid) {
          await handleSessionId(sid);
          setLoading(false);
          return;
        }
      }

      const token = await loadToken();
      if (token) {
        try {
          const me = await api.me();
          setUser(me);
        } catch {
          await setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    })();
  }, [handleSessionId]);

  // Hot deep links (mobile).
  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = Linking.addEventListener("url", ({ url }) => {
      const sid = extractSessionId(url);
      if (sid) handleSessionId(sid);
    });
    return () => sub.remove();
  }, [handleSessionId]);

  const signIn = useCallback(async () => {
    setAuthError(null);
    try {
      if (Platform.OS === "web" && typeof window !== "undefined") {
        const redirectUrl = window.location.origin + "/";
        window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
        return;
      }
      const redirectUrl = Linking.createURL("");
      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      let sid: string | null = null;
      if (result.type === "success" && result.url) sid = extractSessionId(result.url);
      if (!sid) sid = extractSessionId(await Linking.getInitialURL());
      if (sid) await handleSessionId(sid);
    } catch (e: any) {
      setAuthError(e?.message || "Sign in failed.");
    }
  }, [handleSessionId]);

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // ignore
    }
    await setToken(null);
    setUser(null);
    processed.current.clear();
  }, []);

  const value = useMemo(
    () => ({ user, loading, signingIn, authError, signIn, signOut }),
    [user, loading, signingIn, authError, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
