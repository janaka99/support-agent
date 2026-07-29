"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { authApi, setToken, getToken, type CurrentUser, ApiError } from "@/lib/api/index";

// ─── Types ──────────────────────────────────────────────────────

type AuthState = {
  user: CurrentUser | null;
  token: string | null;
  isLoading: boolean;
};

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
};

// ─── Context ────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ───────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isLoading: true,
  });

  /**
   * On mount, check if a token is stored in localStorage.
   * If so, verify it by fetching /auth/me. Silently discard if invalid.
   */
  useEffect(() => {
    const stored = getToken();
    if (!stored) {
      setState((s) => ({ ...s, isLoading: false }));
      return;
    }

    authApi
      .me()
      .then((user) => {
        setState({ user, token: stored, isLoading: false });
      })
      .catch(() => {
        // Token is expired or invalid — clear it
        setToken(null);
        setState({ user: null, token: null, isLoading: false });
      });
  }, []);

  /**
   * Login: POST credentials, store JWT, fetch user profile.
   * Throws ApiError so the calling form can display the error.
   */
  const login = useCallback(async (email: string, password: string) => {
    const { access_token } = await authApi.login(email, password);
    setToken(access_token);
    const user = await authApi.me();
    setState({ user, token: access_token, isLoading: false });
  }, []);

  /**
   * Logout: clear token from memory + localStorage, reset state.
   */
  const logout = useCallback(() => {
    setToken(null);
    setState({ user: null, token: null, isLoading: false });
  }, []);

  const isAdmin = state.user?.role === "admin";

  return (
    <AuthContext.Provider
      value={{ ...state, login, logout, isAdmin }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}

export { ApiError };
