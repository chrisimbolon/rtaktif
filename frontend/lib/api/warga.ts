// lib/api/warga.ts
// API client for Data Warga page
import apiClient from "./client";

export interface WargaUser {
  id:         string;
  full_name:  string;
  email:      string;
  phone:      string | null;
  role:       string;
  status:     "pending" | "active" | "suspended";
  created_at: string | null;
}

export type WargaFilter = "all" | "pending" | "active" | "suspended";

// ── Fetch members of an RT group ─────────────────────────────────────────────
export async function getWargaList(
  rtGroupId: string,
  filter: WargaFilter = "all",
): Promise<WargaUser[]> {
  const params = new URLSearchParams();
  if (filter !== "all") params.set("status", filter);

  const { data } = await apiClient.get<WargaUser[]>(
    `/rt-groups/${rtGroupId}/members?${params.toString()}`
  );
  return data;
}

// ── Verify (activate) a pending user ─────────────────────────────────────────
export async function verifyWarga(userId: string): Promise<WargaUser> {
  const { data } = await apiClient.patch<WargaUser>(
    `/users/${userId}/verify`
  );
  return data;
}

// ── Suspend a user ────────────────────────────────────────────────────────────
export async function suspendWarga(userId: string): Promise<WargaUser> {
  const { data } = await apiClient.patch<WargaUser>(
    `/users/${userId}/suspend`
  );
  return data;
}

// ── Change role ───────────────────────────────────────────────────────────────
export async function changeRole(
  userId: string,
  role: string
): Promise<WargaUser> {
  const { data } = await apiClient.patch<WargaUser>(
    `/users/${userId}/role?role=${role}`
  );
  return data;
}

// ── Helper: format date ───────────────────────────────────────────────────────
export function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day:   "numeric",
    month: "short",
    year:  "numeric",
  }).format(new Date(dateStr));
}

// ── Legacy compat — wargaApi object for useWarga.ts hook ─────────────────────
export const wargaApi = {
  list:    (rtGroupId: string, status?: string) =>
             getWargaList(rtGroupId, (status as WargaFilter) ?? "all"),
  verify:  (userId: string) => verifyWarga(userId),
  suspend: (userId: string) => suspendWarga(userId),
  moveOut: (userId: string) => suspendWarga(userId), // map moveOut → suspend for now
  changeRole,
  formatDate,
};
