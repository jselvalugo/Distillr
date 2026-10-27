import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Product, ProductInput, StorageLocation, StorageLocationInput } from "@shared/reference";
import { apiRequest } from "./queryClient";

export const PRODUCTS_KEY = ["/api/products"] as const;
export const LOCATIONS_KEY = ["/api/storage-locations"] as const;

/** Active products (or every product with `all`), sorted as the admin arranged them. */
export function useProducts(opts: { all?: boolean } = {}) {
  return useQuery<Product[]>({
    queryKey: [...PRODUCTS_KEY, opts.all ? "all" : "active"],
    queryFn: () => apiRequest<Product[]>(`/api/products${opts.all ? "?all=1" : ""}`),
    staleTime: 60_000,
  });
}

export function useStorageLocations(opts: { all?: boolean } = {}) {
  return useQuery<StorageLocation[]>({
    queryKey: [...LOCATIONS_KEY, opts.all ? "all" : "active"],
    queryFn: () => apiRequest<StorageLocation[]>(`/api/storage-locations${opts.all ? "?all=1" : ""}`),
    staleTime: 60_000,
  });
}

/** Finds the catalog entry for a stored product name (case-insensitive). */
export function findProduct(products: Product[] | undefined, name: string | null | undefined): Product | undefined {
  if (!products || !name) return undefined;
  const n = name.trim().toLowerCase();
  return products.find((p) => p.name.toLowerCase() === n);
}

export function useSaveProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<ProductInput> & { id?: string }) =>
      id
        ? apiRequest<Product>(`/api/products/${id}`, { method: "PATCH", body: JSON.stringify(body) })
        : apiRequest<Product>("/api/products", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PRODUCTS_KEY });
      // Renames cascade to batches, barrels, labels, COLAs and inventory records.
      qc.invalidateQueries();
    },
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest(`/api/products/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: PRODUCTS_KEY }),
  });
}

export function useSaveLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<StorageLocationInput> & { id?: string }) =>
      id
        ? apiRequest<StorageLocation>(`/api/storage-locations/${id}`, { method: "PATCH", body: JSON.stringify(body) })
        : apiRequest<StorageLocation>("/api/storage-locations", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LOCATIONS_KEY });
      qc.invalidateQueries();
    },
  });
}

export function useDeleteLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest(`/api/storage-locations/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: LOCATIONS_KEY }),
  });
}

/** The workspace's licensed state (Settings → Company Info), or null if not set yet. */
export function useHomeState(): string | null {
  const { data } = useQuery<{ homeState?: string | null }>({
    queryKey: ["/api/platform-config"],
    queryFn: () => apiRequest("/api/platform-config"),
    staleTime: 60_000,
  });
  return data?.homeState || null;
}
