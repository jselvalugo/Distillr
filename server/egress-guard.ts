import http from "node:http";
import https from "node:https";

const ALLOWED_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function isLoopbackHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return ALLOWED_HOSTS.has(normalized);
}

function extractHostFromRequestOptions(input: unknown): string | null {
  if (!input) return null;

  if (typeof input === "string") {
    try {
      const parsed = new URL(input);
      return parsed.hostname;
    } catch {
      return null;
    }
  }

  if (input instanceof URL) {
    return input.hostname;
  }

  if (typeof input === "object") {
    const option = input as { hostname?: string; host?: string };
    if (option.hostname) return option.hostname;
    if (option.host) return option.host.split(":")[0];
  }

  return null;
}

function assertLoopback(host: string | null): void {
  if (!host) return;
  if (!isLoopbackHost(host)) {
    throw new Error(`Outbound network blocked by local-only policy: ${host}`);
  }
}

export function installEgressGuard(): void {
  const originalFetch = globalThis.fetch;
  if (originalFetch) {
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const host =
        typeof input === "string"
          ? new URL(input).hostname
          : input instanceof URL
            ? input.hostname
            : new URL((input as Request).url).hostname;
      assertLoopback(host);
      return originalFetch(input, init);
    };
  }

  const originalHttpRequest = http.request.bind(http);
  const originalHttpGet = http.get.bind(http);
  const originalHttpsRequest = https.request.bind(https);
  const originalHttpsGet = https.get.bind(https);

  (http as unknown as { request: typeof http.request }).request = ((...args: unknown[]) => {
    assertLoopback(extractHostFromRequestOptions(args[0]));
    return originalHttpRequest(args[0] as never, args[1] as never, args[2] as never);
  }) as typeof http.request;

  (http as unknown as { get: typeof http.get }).get = ((...args: unknown[]) => {
    assertLoopback(extractHostFromRequestOptions(args[0]));
    return originalHttpGet(args[0] as never, args[1] as never, args[2] as never);
  }) as typeof http.get;

  (https as unknown as { request: typeof https.request }).request = ((...args: unknown[]) => {
    assertLoopback(extractHostFromRequestOptions(args[0]));
    return originalHttpsRequest(args[0] as never, args[1] as never, args[2] as never);
  }) as typeof https.request;

  (https as unknown as { get: typeof https.get }).get = ((...args: unknown[]) => {
    assertLoopback(extractHostFromRequestOptions(args[0]));
    return originalHttpsGet(args[0] as never, args[1] as never, args[2] as never);
  }) as typeof https.get;
}
