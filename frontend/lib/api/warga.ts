// lib/api/warga.ts
// Updated: adds ResidentDetail type + getWargaFullProfile()

import apiClient from "./client";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WargaUser {
  id:         string;
  full_name:  string;
  email:      string;
  phone:      string | null;
  block_unit: string | null;
  role:       string;
  status:     "pending" | "active" | "suspended";
  created_at: string | null;
}

export interface ResidentDetail {
  id:                  string;
  full_name:           string;
  nik:                 string | null;
  no_kk:               string | null;
  tanggal_lahir:       string | null;
  tempat_lahir:        string | null;
  jenis_kelamin:       string | null;
  agama:               string | null;
  pekerjaan:           string | null;
  status_kawin:        string | null;
  status_tinggal:      string | null;
  status_keluarga:     string | null;
  hubungan_dengan_kk:  string | null;
  kepala_keluarga:     boolean;
  pendidikan_terakhir: string | null;
  kewarganegaraan:     string | null;
  alamat_ktp:          string | null;
  phone:               string | null;
  block_unit:          string | null;
  kk_members?:         ResidentDetail[];
}

export type WargaFilter = "all" | "pending" | "active" | "suspended";

// ── API calls ─────────────────────────────────────────────────────────────────

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

export async function getWargaFullProfile(
  userId: string
): Promise<ResidentDetail> {
  const { data } = await apiClient.get<ResidentDetail>(
    `/warga/user/${userId}/profile`
  );
  return data;
}

export async function verifyWarga(userId: string): Promise<WargaUser> {
  const { data } = await apiClient.patch<WargaUser>(
    `/users/${userId}/verify`
  );
  return data;
}

export async function suspendWarga(userId: string): Promise<WargaUser> {
  const { data } = await apiClient.patch<WargaUser>(
    `/users/${userId}/suspend`
  );
  return data;
}

export async function changeRole(
  userId: string, role: string
): Promise<WargaUser> {
  const { data } = await apiClient.patch<WargaUser>(
    `/users/${userId}/role?role=${role}`
  );
  return data;
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric", month: "short", year: "numeric",
  }).format(new Date(dateStr));
}

export const wargaApi = {
  list:      (rtGroupId: string, status?: string) =>
               getWargaList(rtGroupId, (status as WargaFilter) ?? "all"),
  verify:    (userId: string) => verifyWarga(userId),
  suspend:   (userId: string) => suspendWarga(userId),
  moveOut:   (userId: string) => suspendWarga(userId),
  changeRole,
  formatDate,
};
