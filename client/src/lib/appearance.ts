import { apiRequest, queryClient } from "./queryClient";

/**
 * Dashboard appearance (light/dark canvas + org color) comes from
 * /api/platform-config. Until that request returns, the dashboard used to fall
 * back to the dark canvas, so light-theme orgs saw a black flash on login.
 *
 * We keep the last known appearance on this device so the very first frame is
 * already right, and fetch the config as soon as the user is known instead of
 * waiting for the dashboard to mount.
 */

export type Appearance = { theme: "light" | "dark"; dashboardColor: string | null };

const KEY = "distillr:appearance";
export const PLATFORM_CONFIG_KEY = ["/api/platform-config"] as const;

export function readCachedAppearance(): Appearance | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (v?.theme !== "light" && v?.theme !== "dark") return null;
    return { theme: v.theme, dashboardColor: typeof v.dashboardColor === "string" ? v.dashboardColor : null };
  } catch {
    return null;
  }
}

export function cacheAppearance(config: { theme?: "light" | "dark" | null; dashboardColor?: string | null } | null | undefined) {
  if (!config) return;
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({ theme: config.theme === "light" ? "light" : "dark", dashboardColor: config.dashboardColor ?? null }),
    );
  } catch {
    /* storage unavailable — nothing to do */
  }
}

/** Shared fetcher so every caller (header, dashboard, settings) refreshes the device cache. */
export async function fetchPlatformConfig<T = any>(): Promise<T> {
  const config = await apiRequest<T>("/api/platform-config");
  cacheAppearance(config as any);
  return config;
}

/** Start loading the config early (on login / session restore). */
export function prefetchPlatformConfig() {
  return queryClient.prefetchQuery({ queryKey: PLATFORM_CONFIG_KEY, queryFn: fetchPlatformConfig, staleTime: 60_000 });
}
