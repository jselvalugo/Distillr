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

export async function apiRequest<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const res = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(MUTATING.has(method) && _csrfToken ? { "x-csrf-token": _csrfToken } : {}),
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  const token = res.headers.get("x-csrf-token");
  if (token) _csrfToken = token;
  await throwIfNotOk(res);
  if (res.status === 204 || res.headers.get("content-length") === "0") return undefined as T;
  return res.json() as Promise<T>;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});
