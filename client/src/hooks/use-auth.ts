import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import type { SafeUser } from "@shared/schema";

type AuthResponse = { user: SafeUser; csrfToken: string };

export function useAuth() {
  const qc = useQueryClient();

  const { data: user, isLoading } = useQuery<SafeUser | null>({
    queryKey: ["/api/auth/me"],
    queryFn: () =>
      apiRequest<AuthResponse>("/api/auth/me")
        .then((r) => r.user)
        .catch(() => null),
    staleTime: Infinity,
  });

  const loginMut = useMutation({
    mutationFn: (creds: { email: string; password: string }) =>
      apiRequest<AuthResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(creds),
      }),
    onSuccess: (r) => qc.setQueryData(["/api/auth/me"], r.user),
  });

  const logoutMut = useMutation({
    mutationFn: () => apiRequest("/api/auth/logout", { method: "POST" }),
    onSuccess: () => {
      qc.setQueryData(["/api/auth/me"], null);
      qc.clear();
    },
  });

  const signupMut = useMutation({
    mutationFn: (data: { distilleryName: string; adminName: string; email: string; password: string }) =>
      apiRequest<AuthResponse>("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (r) => qc.setQueryData(["/api/auth/me"], r.user),
  });

  return {
    user: user ?? null,
    isLoading,
    login: loginMut,
    logout: logoutMut,
    signup: signupMut,
  };
}
