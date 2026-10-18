"use client";

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { authApi } from "@/lib/api-client";
import type { Role, User } from "@/lib/types";

interface AuthState {
  user: User | null;
  /** True until the first `/api/auth/me` round-trip finishes. */
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (input: {
    name: string;
    email: string;
    password: string;
    role: "student" | "teacher";
  }) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  hasRole: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { user } = await authApi.me();
      setUser(user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    authApi
      .me()
      .then(({ user }) => !cancelled && setUser(user))
      .catch(() => !cancelled && setUser(null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      refresh,
      login: async (email, password) => {
        const { user } = await authApi.login({ email, password });
        setUser(user);
        return user;
      },
      register: async (input) => {
        const { user } = await authApi.register(input);
        setUser(user);
        return user;
      },
      logout: async () => {
        await authApi.logout();
        setUser(null);
      },
      hasRole: (...roles) => user !== null && roles.includes(user.role),
    }),
    [user, loading, refresh],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthState {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
