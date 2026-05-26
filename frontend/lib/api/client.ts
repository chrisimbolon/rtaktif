// lib/api/client.ts
// ─────────────────────────────────────────────────────────────────────────────
// Axios client that auto-attaches the FastAPI JWT from NextAuth session.
//
// Token priority:
//   1. NextAuth session.backendToken (set via getSession)
//   2. No token → request sent without auth (will 403 on protected endpoints)
// ─────────────────────────────────────────────────────────────────────────────

import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { getSession } from "next-auth/react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 15_000,
});

// Attach JWT from NextAuth session on every request
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    if (typeof window !== "undefined") {
      const session = await getSession();
      const token   = (session as any)?.backendToken;
      if (token) config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (err) => Promise.reject(err),
);

// Global error handler — redirect to login on 401
apiClient.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    if (err.response?.status === 401 && typeof window !== "undefined") {
      window.location.href = "/login";
    }
    return Promise.reject(err);
  },
);

export default apiClient;
