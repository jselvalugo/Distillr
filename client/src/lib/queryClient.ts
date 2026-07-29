import { QueryClient } from "@tanstack/react-query";

let _csrfToken: string | null = null;
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

async function throwIfNotOk(res: Response) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = (body as any).message || (body as any).error || res.statusText || "Request failed";
    throw new Error(msg);
  }
}

async function fetchCsrfToken(): Promise<void> {
  try {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    const token = res.headers.get("x-csrf-token");
    if (token) _csrfToken = token;
  } catch {
    // ignore — if this fails we let the original request fail naturally
  }
}

export async function getCsrfToken(): Promise<string | null> {
  if (!_csrfToken) await fetchCsrfToken();
  return _csrfToken;
}

export async function apiRequest<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();

  // If we're about to mutate and have no token yet, fetch one first
  if (MUTATING.has(method) && !_csrfToken) {
    await fetchCsrfToken();
  }

  const doFetch = () =>
    fetch(path, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(MUTATING.has(method) && _csrfToken ? { "x-csrf-token": _csrfToken } : {}),
        ...(init?.headers ?? {}),
      },
      ...init,
    });

  let res = await doFetch();
  const token = res.headers.get("x-csrf-token");
  if (token) _csrfToken = token;

  // On CSRF rejection, refresh the token and retry once
  if (res.status === 403 && MUTATING.has(method)) {
    const body = await res.json().catch(() => ({}));
    if ((body as any).error === "Invalid CSRF token") {
      await fetchCsrfToken();
      res = await doFetch();
      const retryToken = res.headers.get("x-csrf-token");
      if (retryToken) _csrfToken = retryToken;
    } else {
      // Not a CSRF error — re-throw original body as error
      const msg = (body as any).message || (body as any).error || res.statusText || "Request failed";
      throw new Error(msg);
    }
  }

  await throwIfNotOk(res);
  if (res.status === 204 || res.headers.get("content-length") === "0") return undefined as T;
  return res.json() as Promise<T>;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});
