import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthUser } from "@/types";

interface AuthState {
  user:  AuthUser | null;
  token: string | null;
  setAuth: (user: AuthUser, token: string) => void;
  clearAuth: () => void;
  isAdmin: () => boolean;
  isWarga: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user:  null,
      token: null,
      setAuth: (user, token) => {
        set({ user, token });
        if (typeof window !== "undefined") {
          localStorage.setItem("rukunrt_token", token);
        }
      },
      clearAuth: () => {
        set({ user: null, token: null });
        if (typeof window !== "undefined") {
          localStorage.removeItem("rukunrt_token");
        }
      },
      isAdmin: () => {
        const role = get().user?.role;
        return ["admin_rt", "admin_rw", "super_admin"].includes(role ?? "");
      },
      isWarga: () => get().user?.role === "warga",
    }),
    { name: "rukunrt-auth", partialize: (s) => ({ user: s.user, token: s.token }) }
  )
);
