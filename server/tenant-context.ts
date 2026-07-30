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
