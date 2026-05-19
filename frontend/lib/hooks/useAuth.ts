// // lib/hooks/useAuth.ts
"use client";

import type { LoginPayload } from "@/types";
import { useMutation } from "@tanstack/react-query";
import { signIn, signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

const ADMIN_ROLES = ["admin_rt", "admin_rw", "super_admin"];

export function useAuth() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const user = session?.user ?? null;
  const token = session?.backendToken ?? null;

  const loginMutation = useMutation({
    mutationFn: async (payload: LoginPayload) => {
      const result = await signIn("credentials", {
        email: payload.email,
        password: payload.password,
        redirect: false,
      });

      if (!result || result.error) {
        throw new Error("Login failed");
      }

      return result;
    },

    onSuccess: async () => {
      // small delay so session hydrates properly
      await new Promise((r) => setTimeout(r, 100));

      const currentRole = session?.user?.role;

      if (ADMIN_ROLES.includes(currentRole ?? "")) {
        router.push("/dashboard");
      } else {
        router.push("/beranda");
      }

      router.refresh();
    },
  });

  const logout = async () => {
    await signOut({
      redirect: true,
      callbackUrl: "/login",
    });
  };

  return {
    user,
    token,
    status,
    loginMutation,
    logout,

    isAdmin:
      !!user && ADMIN_ROLES.includes(user.role),

    isWarga:
      user?.role === "warga",
  };
}

// "use client";
// import { authApi } from "@/lib/api/auth";
// import { useAuthStore } from "@/store/auth.store";
// import type { LoginPayload } from "@/types";
// import { useMutation } from "@tanstack/react-query";
// import { useRouter } from "next/navigation";

// export function useAuth() {
//   const { user, token, setAuth, clearAuth, isAdmin, isWarga } = useAuthStore();
//   const router = useRouter();

//   const loginMutation = useMutation({
//     mutationFn: async (payload: LoginPayload) => {
//       const tokenRes = await authApi.login(payload);
//       // Store token first so apiClient picks it up
//       if (typeof window !== "undefined") {
//         localStorage.setItem("rukunrt_token", tokenRes.access_token);
//       }
//       const me = await authApi.me();
//       return { token: tokenRes.access_token, user: me };
//     },
//     onSuccess: ({ token, user }) => {
//       setAuth(user, token);
//       // Route based on role
//       if (["admin_rt", "admin_rw", "super_admin"].includes(user.role)) {
//         router.push("/dashboard");
//       } else {
//         router.push("/beranda");
//       }
//     },
//   });

//   const logout = () => {
//     clearAuth();
//     router.push("/login");
//   };

//   return { user, token, isAdmin, isWarga, loginMutation, logout };
// }
