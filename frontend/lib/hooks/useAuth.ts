// lib/hooks/useAuth.ts
// All NextAuth augmented fields (full_name, role, status) are accessed
// via (session as any) ONCE here, then exposed as plain typed strings.
// This prevents TypeScript errors in Docker build where next-auth.d.ts
// augmentation may not be resolved.
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

  // Cast session to any ONCE here — extracts all augmented fields safely
  const s = session as any;

  const isLoading = status === "loading";
  const token     = s?.backendToken  as string | undefined;
  const fullName  = s?.user?.full_name as string | undefined;
  const role      = s?.user?.role     as string | undefined;
  const userStatus = s?.user?.status  as string | undefined;
  const rtGroupId = s?.user?.rt_group_id as string | null | undefined;
  const userId    = s?.user?.id       as string | undefined;
  const email     = s?.user?.email    as string | undefined;

  // Expose a plain user object — no NextAuth type dependency
  const user = session ? {
    id:          userId    ?? "",
    email:       email     ?? "",
    full_name:   fullName  ?? "",
    role:        role      ?? "",
    status:      userStatus ?? "",
    rt_group_id: rtGroupId ?? null,
  } : null;

  const isAdmin = () => ADMIN_ROLES.includes(role ?? "");
  const isWarga = () => role === "warga";

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
      await new Promise((r) => setTimeout(r, 200));
      const res        = await fetch("/api/auth/session");
      const data       = await res.json() as any;
      const sessionRole = data?.user?.role as string ?? "";
      router.push(ADMIN_ROLES.includes(sessionRole) ? "/dashboard" : "/beranda");
      router.refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Logout ─────────────────────────────────────────────────────
  const logout = async () => {
    await signOut({ redirect: false });
    router.push("/login");
    toast.success("Sampai jumpa! 👋");
  };

  return {
    // Plain typed user object — safe to use in all components
    user,
    // Individual fields for convenience
    token,
    fullName,
    role,
    userStatus,
    rtGroupId,
    // Status
    status,
    isLoading,
    // Helpers
    isAdmin,
    isWarga,
    // Actions
    loginMutation,
    logout,
  };
}
