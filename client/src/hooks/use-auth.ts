import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import type { SafeUser } from "@shared/schema";

export function useAuth() {
  const qc = useQueryClient();

  const { data: user, isLoading } = useQuery<SafeUser | null>({
    queryKey: ["/api/auth/me"],
    queryFn: () => apiRequest<SafeUser>("/api/auth/me").catch(() => null),
    staleTime: Infinity,
  });

  const loginMut = useMutation({
    mutationFn: (creds: { email: string; password: string }) =>
      apiRequest<SafeUser>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(creds),
      }),
    onSuccess: (u) => qc.setQueryData(["/api/auth/me"], u),
  });

  const logoutMut = useMutation({
    mutationFn: () => apiRequest("/api/auth/logout", { method: "POST" }),
    onSuccess: () => {
      qc.setQueryData(["/api/auth/me"], null);
      qc.clear();
    },
  });

  return {
    user: user ?? null,
    isLoading,
    login: loginMut,
    logout: logoutMut,
  };
}
