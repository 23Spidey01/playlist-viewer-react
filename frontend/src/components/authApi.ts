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
  username: string;
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

export async function login(username: string, password: string): Promise<ApiResult> {
  const { headerName, token } = await getCsrf();
  const body = new URLSearchParams({ username, password });

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
  return { ok: false, error: "Invalid username or password." };
}

// No email field — registration only asks for a username, deliberately
// not collecting an email address (the backend still supports one, but
// nothing on this site sends it).
export async function register(username: string, password: string): Promise<ApiResult> {
  const { headerName, token } = await getCsrf();

  const res = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      [headerName]: token,
    },
    body: JSON.stringify({ username, password }),
  });

  if (res.status === 201) return { ok: true };
  const data = await res.json().catch(() => null);
  return { ok: false, error: data?.message || "Registration failed." };
}

export async function logout(): Promise<void> {
  await authFetch("/api/auth/logout", { method: "POST" });
  csrf = null;
}

// Spring's default error responses omit the actual reason text unless
// the app opts in (server.error.include-message, not set here), so
// this only shows AccountService's specific message (e.g. "Current
// password is incorrect") if the backend happens to include one, and
// otherwise falls back to a generic message per status code — the
// same reasoning as postToPool's error fallback elsewhere.
async function accountErrorMessage(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => null);
  if (data?.message) return data.message;
  if (res.status === 401) return "Current password is incorrect.";
  if (res.status === 409) return "That's already taken by another account.";
  return fallback;
}

// Each of these changes the account's own credentials, which
// invalidates the current session server-side the moment it succeeds
// (AccountController logs the session out on every successful call) —
// the caller is responsible for reflecting that locally (clear the
// cached user, redirect to /login) once `ok` comes back true.
export async function changeUsername(
  currentPassword: string,
  newUsername: string,
): Promise<ApiResult> {
  const res = await authFetch("/api/account/username", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword, newUsername }),
  });
  if (res.ok) {
    csrf = null;
    return { ok: true };
  }
  return { ok: false, error: await accountErrorMessage(res, "Could not change your username.") };
}

export async function changeEmail(currentPassword: string, newEmail: string): Promise<ApiResult> {
  const res = await authFetch("/api/account/email", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword, newEmail }),
  });
  if (res.ok) {
    csrf = null;
    return { ok: true };
  }
  return { ok: false, error: await accountErrorMessage(res, "Could not change your email.") };
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<ApiResult> {
  const res = await authFetch("/api/account/password", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (res.ok) {
    csrf = null;
    return { ok: true };
  }
  return { ok: false, error: await accountErrorMessage(res, "Could not change your password.") };
}

export async function listApiKeys(): Promise<ApiKeySummary[]> {
  const keys: ApiKeySummary[] = [];
  const size = 100;
  for (let page = 0; page <= 10000; page++) {
    const res = await authFetch(`/api/api-keys?page=${page}&size=${size}`);
    if (!res.ok || isAuthRedirect(res)) return [];
    const batch: ApiKeySummary[] = await res.json();
    keys.push(...batch);
    if (batch.length < size) return keys;
  }
  return keys;
}

// Used by askApiKey() to silently look up a saved key before falling
// back to the manual-paste prompt. Returns null for "no saved key" AND
// for "not logged in" — callers don't need to tell those apart.
export async function getApiKeyForPool(pool: string): Promise<string | null> {
  try {
    const res = await authFetch(`/api/api-keys?pool=${encodeURIComponent(pool)}&size=1`);
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
