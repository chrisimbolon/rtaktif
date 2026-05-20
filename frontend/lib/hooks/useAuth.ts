// lib/hooks/useAuth.ts — auth from NextAuth ONLY, no Zustand
"use client";
import type { LoginPayload } from "@/types";
import { useMutation } from "@tanstack/react-query";
import { signIn, signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const ADMIN_ROLES = ["admin_rt", "admin_rw", "super_admin"];

export function useAuth() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // ── Derived state directly from NextAuth session ──────────────
  const user      = session?.user      ?? null;
  const token     = session?.backendToken ?? null;
  const isLoading = status === "loading";
  const isAdmin   = () => ADMIN_ROLES.includes(user?.role ?? "");
  const isWarga   = () => user?.role === "warga";

  // ── Login ──────────────────────────────────────────────────────
  const loginMutation = useMutation({
    mutationFn: async (payload: LoginPayload) => {
      const result = await signIn("credentials", {
        email:    payload.email,
        password: payload.password,
        redirect: false,
      });

      if (result?.error) {
        const errorMap: Record<string, string> = {
          CredentialsSignin: "Email atau password salah",
          AccountPending:    "Akun belum diverifikasi admin RT",
          AccountSuspended:  "Akun Anda telah disuspend",
          Default:           "Terjadi kesalahan. Silakan coba lagi",
        };
        throw new Error(errorMap[result.error] ?? errorMap.Default);
      }
      return result;
    },
    onSuccess: async () => {
      // Wait briefly for session cookie to be set
      await new Promise((r) => setTimeout(r, 200));

      // Fetch fresh session → route by role
      const res  = await fetch("/api/auth/session");
      const data = await res.json();
      const role = data?.user?.role ?? "";

      if (ADMIN_ROLES.includes(role)) {
        router.push("/dashboard");
      } else {
        router.push("/beranda");
      }
      router.refresh();
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  // ── Logout ─────────────────────────────────────────────────────
  const logout = async () => {
    await signOut({ redirect: false });
    router.push("/login");
    toast.success("Sampai jumpa! 👋");
  };

  return { user, token, session, status, isLoading, isAdmin, isWarga, loginMutation, logout };
}
