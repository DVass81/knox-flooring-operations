import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { setCsrfToken } from "@workspace/api-client-react";

export type AppRole = "owner" | "sales" | "operations" | "installer";
type User = { id: string; email: string; name: string; role: AppRole; actualRole?: AppRole; previewRole?: AppRole | null };
type AuthContextValue = { user: User | null; loading: boolean; login(email: string, password: string): Promise<void>; logout(): Promise<void>; switchPersona(role: Exclude<AppRole, "owner"> | null): Promise<void>; forgot(email: string): Promise<string>; reset(token: string, password: string): Promise<void> };
const AuthContext = createContext<AuthContextValue | null>(null);

async function request(path: string, init?: RequestInit) {
  const response = await fetch(`/api${path}`, { credentials: "include", headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }, ...init });
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error ?? "Request failed"); return body;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null); const [loading, setLoading] = useState(true); const [csrf, setCsrf] = useState<string | null>(null);
  const accept = (body: any) => { setUser(body.user); setCsrf(body.csrfToken); setCsrfToken(body.csrfToken); };
  useEffect(() => { request("/auth/session").then(accept).catch(() => { setUser(null); setCsrfToken(null); }).finally(() => setLoading(false)); }, []);
  const value = useMemo<AuthContextValue>(() => ({ user, loading,
    login: async (email, password) => { const body = await request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }); accept(body); },
    logout: async () => { await request("/auth/logout", { method: "POST", headers: csrf ? { "x-csrf-token": csrf } : {} }); setUser(null); setCsrf(null); setCsrfToken(null); },
    switchPersona: async (role) => { const body = await request("/auth/persona", { method: "POST", headers: csrf ? { "x-csrf-token": csrf } : {}, body: JSON.stringify({ role }) }); accept(body); },
    forgot: async (email) => (await request("/auth/password/forgot", { method: "POST", body: JSON.stringify({ email }) })).message,
    reset: async (token, password) => { await request("/auth/password/reset", { method: "POST", body: JSON.stringify({ token, password }) }); },
  }), [user, loading, csrf]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error("AuthProvider missing"); return value; }
