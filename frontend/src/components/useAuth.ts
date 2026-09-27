// useAuth.ts — split from AuthContext.tsx (which must only export the
// <AuthProvider> component for Fast Refresh) so this hook and the
// context object it reads from can live anywhere.
import { createContext, useContext } from "react";
import type { CurrentUser } from "./authApi";

export interface AuthResult {
  ok: boolean;
  error?: string;
}

export interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  register: (email: string, password: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
