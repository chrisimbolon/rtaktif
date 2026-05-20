// lib/api/client.ts
// reads JWT from NextAuth session instead of localStorage
import axios, { type InternalAxiosRequestConfig } from "axios";
import { getSession, signOut } from "next-auth/react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 15_000,
});

// ── Request interceptor: attach JWT ───────────────────────────────
apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  try {
    // Primary: read backendToken from NextAuth session (httpOnly cookie)
    const session = await getSession();
    if (session?.backendToken) {
      config.headers.Authorization = `Bearer ${session.backendToken}`;
      return config;
    }
  } catch {
    // getSession() may throw in SSR context — fall through to localStorage
  }

  // Fallback: localStorage (dev convenience / SSR fallback)
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("rukunrt_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// ── Response interceptor: handle 401 ─────────────────────────────
apiClient.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      await signOut({ redirect: false });
      if (typeof window !== "undefined") {
        localStorage.removeItem("rukunrt_token");
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

export default apiClient;
