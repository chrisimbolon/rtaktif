// lib/api/rtgroup.ts
// RT Group API client — GET and PATCH for /pengaturan page
// Uses backendToken from NextAuth session (server components)
// or apiClient with interceptor (client components).

import type { RTGroup } from "@/types";

const API_BASE = process.env.INTERNAL_API_URL
  ?? process.env.NEXT_PUBLIC_API_URL
  ?? "http://localhost:8000/api/v1";

export interface UpdateRTGroupPayload {
  rt_number?:       string;
  rw_number?:       string;
  kelurahan?:       string;
  kecamatan?:       string;
  kota?:            string;
  provinsi?:        string;
  monthly_fee_idr?: number;
}

// ── Server-side (used in Server Components / Route Handlers) ─────────────────

export async function getRTGroupServer(
  rtGroupId: string,
  backendToken: string,
): Promise<RTGroup> {
  const res = await fetch(`${API_BASE}/rt-groups/${rtGroupId}`, {
    headers: { Authorization: `Bearer ${backendToken}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? `Failed to fetch RT group (${res.status})`);
  }
  return res.json();
}

export async function updateRTGroupServer(
  rtGroupId: string,
  payload: UpdateRTGroupPayload,
  backendToken: string,
): Promise<RTGroup> {
  const res = await fetch(`${API_BASE}/rt-groups/${rtGroupId}`, {
    method:  "PATCH",
    headers: {
      Authorization:  `Bearer ${backendToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? `Failed to update RT group (${res.status})`);
  }
  return res.json();
}

// ── Client-side (used in Client Components via apiClient) ────────────────────

import apiClient from "./client";
import type { AxiosError } from "axios";

export async function getRTGroupClient(rtGroupId: string): Promise<RTGroup> {
  const { data } = await apiClient.get<RTGroup>(`/rt-groups/${rtGroupId}`);
  return data;
}

export async function updateRTGroupClient(
  rtGroupId: string,
  payload: UpdateRTGroupPayload,
): Promise<RTGroup> {
  const { data } = await apiClient.patch<RTGroup>(
    `/rt-groups/${rtGroupId}`,
    payload,
  );
  return data;
}

// ── Error helper ─────────────────────────────────────────────────────────────

export function extractApiError(err: unknown): string {
  if (err instanceof Error) return err.message;
  const axiosErr = err as AxiosError<{ detail: string }>;
  return axiosErr?.response?.data?.detail ?? "Terjadi kesalahan. Coba lagi.";
}
