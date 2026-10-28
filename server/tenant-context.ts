import { AsyncLocalStorage } from "node:async_hooks";

const tenantStore = new AsyncLocalStorage<string>();

export function getCurrentTenantId(): string {
  const id = tenantStore.getStore();
  if (!id) throw new Error("No tenant context active");
  return id;
}

export function runWithTenant<T>(tenantId: string, fn: () => T | Promise<T>): Promise<T> {
  return tenantStore.run(tenantId, fn as () => Promise<T>);
}

/** The current request's tenant, or null outside any tenant (platform/admin code). */
export function tryGetCurrentTenantId(): string | null {
  return tenantStore.getStore() ?? null;
}
