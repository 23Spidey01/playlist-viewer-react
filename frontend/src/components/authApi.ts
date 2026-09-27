// authApi.ts — talks to the backend's session-cookie auth (/api/auth/*)
// and per-pool API key storage (/api/api-keys). Login/logout use a
// separate, explicit fetch (they're always permitAll and never hit the
// loginPage redirect); every other call goes through authFetch, which
// attaches the CSRF header for mutations and uses redirect: "manual"
// so an unauthenticated request comes back as an opaque redirect
// instead of silently following Spring Security's /login redirect and
// returning an HTML page where JSON was expected.
const BASE = "http://localhost:3001";

export interface CurrentUser {
  email: string;
}

export interface ApiKeySummary {
  id: string;
  pool: string;
  createdAt: string;
  updatedAt: string;
}

interface ApiResult {
  ok: boolean;
  error?: string;
}

let csrf: { headerName: string; token: string } | null = null;

async function getCsrf(): Promise<{ headerName: string; token: string }> {
  if (csrf) return csrf;
  const res = await fetch(`${BASE}/api/auth/csrf`, { credentials: "include" });
  const data = await res.json();
  csrf = { headerName: data.headerName, token: data.token };
  return csrf;
}

async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const method = (options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers);

  if (method !== "GET" && method !== "HEAD") {
    const { headerName, token } = await getCsrf();
    headers.set(headerName, token);
  }

  return fetch(`${BASE}${path}`, {
    ...options,
    headers,
    credentials: "include",
    redirect: "manual",
  });
}

function isAuthRedirect(res: Response): boolean {
  return res.type === "opaqueredirect" || res.status === 0;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const res = await authFetch("/api/auth/me");
    if (!res.ok || isAuthRedirect(res)) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function login(email: string, password: string): Promise<ApiResult> {
  const { headerName, token } = await getCsrf();
  const body = new URLSearchParams({ email, password });

  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      [headerName]: token,
    },
    body,
  });

  // A successful login rotates the session's CSRF token server-side
  // (Spring Security's fixation protection), so the token fetched
  // before login is now stale — drop it and let the next mutating
  // call fetch a fresh one.
  if (res.status === 204) {
    csrf = null;
    return { ok: true };
  }
  return { ok: false, error: "Invalid email or password." };
}

export async function register(email: string, password: string): Promise<ApiResult> {
  const { headerName, token } = await getCsrf();

  const res = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      [headerName]: token,
    },
    body: JSON.stringify({ email, password }),
  });

  if (res.status === 201) return { ok: true };
  const data = await res.json().catch(() => null);
  return { ok: false, error: data?.message || "Registration failed." };
}

export async function logout(): Promise<void> {
  await authFetch("/api/auth/logout", { method: "POST" });
  csrf = null;
}

export async function listApiKeys(): Promise<ApiKeySummary[]> {
  const res = await authFetch("/api/api-keys");
  if (!res.ok || isAuthRedirect(res)) return [];
  return res.json();
}

// Used by askApiKey() to silently look up a saved key before falling
// back to the manual-paste prompt. Returns null for "no saved key" AND
// for "not logged in" — callers don't need to tell those apart.
export async function getApiKeyForPool(pool: string): Promise<string | null> {
  try {
    const res = await authFetch(`/api/api-keys?pool=${encodeURIComponent(pool)}`);
    if (!res.ok || isAuthRedirect(res)) return null;
    const data: { id: string; apiKey: string }[] = await res.json();
    return data.length > 0 ? data[0].apiKey : null;
  } catch {
    return null;
  }
}

export async function createApiKey(pool: string, apiKey: string): Promise<ApiResult> {
  const res = await authFetch("/api/api-keys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pool, apiKey }),
  });

  if (res.status === 201) return { ok: true };
  const data = await res.json().catch(() => null);
  return { ok: false, error: data?.message || "Could not save the API key." };
}

export async function updateApiKey(id: string, pool: string, apiKey: string): Promise<ApiResult> {
  const res = await authFetch(`/api/api-keys/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pool, apiKey }),
  });

  if (res.ok) return { ok: true };
  const data = await res.json().catch(() => null);
  return { ok: false, error: data?.message || "Could not update the API key." };
}

export async function deleteApiKey(id: string): Promise<boolean> {
  const res = await authFetch(`/api/api-keys/${id}`, { method: "DELETE" });
  return res.ok;
}
