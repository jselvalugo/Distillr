import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";

export function useAdminAuth() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{ ok: boolean } | null>({
    queryKey: ["/api/admin/me"],
    queryFn: () => apiRequest<{ ok: boolean }>("/api/admin/me").catch(() => null),
    staleTime: Infinity,
    retry: false,
  });

  const loginMut = useMutation({
    mutationFn: (creds: { email: string; password: string }) =>
      apiRequest<{ ok: boolean }>("/api/admin/login", {
        method: "POST",
        body: JSON.stringify(creds),
      }),
    onSuccess: () => qc.setQueryData(["/api/admin/me"], { ok: true }),
  });

  const logoutMut = useMutation({
    mutationFn: () => apiRequest("/api/admin/logout", { method: "POST" }),
    onSuccess: () => {
      qc.setQueryData(["/api/admin/me"], null);
      qc.clear();
    },
  });

  return {
    isAdmin: data?.ok === true,
    isLoading,
    login: loginMut,
    logout: logoutMut,
  };
}
