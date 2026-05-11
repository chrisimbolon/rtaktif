// lib/hooks/useAuth.ts
"use client";
import { authApi } from "@/lib/api/auth";
import { useAuthStore } from "@/store/auth.store";
import type { LoginPayload } from "@/types";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

export function useAuth() {
  const { user, token, setAuth, clearAuth, isAdmin, isWarga } = useAuthStore();
  const router = useRouter();

  const loginMutation = useMutation({
    mutationFn: async (payload: LoginPayload) => {
      const tokenRes = await authApi.login(payload);
      // Store token first so apiClient picks it up
      if (typeof window !== "undefined") {
        localStorage.setItem("rukunrt_token", tokenRes.access_token);
      }
      const me = await authApi.me();
      return { token: tokenRes.access_token, user: me };
    },
    onSuccess: ({ token, user }) => {
      setAuth(user, token);
      // Route based on role
      if (["admin_rt", "admin_rw", "super_admin"].includes(user.role)) {
        router.push("/dashboard");
      } else {
        router.push("/beranda");
      }
    },
  });

  const logout = () => {
    clearAuth();
    router.push("/login");
  };

  return { user, token, isAdmin, isWarga, loginMutation, logout };
}
