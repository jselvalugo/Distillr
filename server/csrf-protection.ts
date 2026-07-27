import { randomBytes, timingSafeEqual } from "node:crypto";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const CSRF_EXEMPT_PATHS = new Set(["/api/auth/login"]);

export const CSRF_HEADER_NAME = "x-csrf-token";

export function createCsrfToken(): string {
  return randomBytes(32).toString("hex");
}

export function shouldEnforceCsrf(method: string, path: string): boolean {
  const normalizedMethod = String(method || "").toUpperCase();
  const normalizedPath = String(path || "");

  if (!normalizedPath.startsWith("/api")) return false;
  if (!MUTATING_METHODS.has(normalizedMethod)) return false;
  if (CSRF_EXEMPT_PATHS.has(normalizedPath)) return false;
  return true;
}

export function isCsrfTokenValid(
  providedToken: string | undefined | null,
  expectedToken: string | undefined | null,
): boolean {
  if (!providedToken || !expectedToken) return false;
  const provided = Buffer.from(providedToken);
  const expected = Buffer.from(expectedToken);
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}
