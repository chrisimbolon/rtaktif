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
  is_ghost?:  boolean;
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

export interface AdminUpdateResidentPayload {
  full_name?:           string;
  phone?:               string;
  nik?:                 string;
  no_kk?:               string;
  tanggal_lahir?:       string;   // ISO date "YYYY-MM-DD"
  tempat_lahir?:        string;
  jenis_kelamin?:       string;
  agama?:               string;
  pekerjaan?:           string;
  status_kawin?:        string;
  status_tinggal?:      string;
  status_keluarga?:     string;
  kepala_keluarga?:     boolean;
  alamat_ktp?:          string;
  pendidikan_terakhir?: string;
  kewarganegaraan?:     string;
  hubungan_dengan_kk?:  string;
}

export interface AdminUpdateResponse {
  message:        string;
  changed_fields: number;
  changes: {
    field:     string;
    label:     string;
    old_value: string | null;
    new_value: string | null;
  }[];
}

export interface ChangeLogEntry {
  id:               string;
  field_name:       string;
  field_label:      string;
  old_value:        string | null;
  new_value:        string | null;
  changed_by:       string;
  changed_by_name:  string;
  changed_by_role:  string;
  resident_name:    string;
  changed_at:       string;   // ISO string
}

// ─── New API calls ────────────────────────────────────────────────────────────

export const updateResidentProfile = async (
  residentId: string,
  payload: AdminUpdateResidentPayload,
): Promise<AdminUpdateResponse> => {
  const { data } = await apiClient.patch<AdminUpdateResponse>(
    `/warga/${residentId}/admin-update`,
    payload,
  );
  return data;
};

export const getResidentChangeLog = async (
  residentId: string,
  limit = 20,
): Promise<ChangeLogEntry[]> => {
  const { data } = await apiClient.get<ChangeLogEntry[]>(
    `/warga/${residentId}/change-log`,
    { params: { limit } },
  );
  return data;
};

// ─── Enum option lists (for dropdowns in edit form) ───────────────────────────
// Derived from domain entities — update if enums change

export const JENIS_KELAMIN_OPTIONS = ["LAKI-LAKI", "PEREMPUAN"] as const;

export const AGAMA_OPTIONS = [
  "ISLAM", "KATHOLIK", "KRISTEN", "HINDU", "BUDDHA", "KONGHUCU",
] as const;

export const PEKERJAAN_OPTIONS = [
  "PELAJAR/MAHASISWA", "PNS", "KARYAWAN SWASTA", "KARYAWAN BUMN",
  "TNI", "POLRI", "NAKES", "WIRASWASTA", "MENGURUS RUMAH TANGGA",
  "GURU", "OJEK", "LAINNYA",
] as const;

export const STATUS_KAWIN_OPTIONS = [
  "BELUM KAWIN", "KAWIN", "CERAI HIDUP", "CERAI MATI",
] as const;

export const STATUS_TINGGAL_OPTIONS = [
  "TETAP", "KONTRAK", "KOST", "PINDAH", "MENINGGAL", "LAINNYA",
] as const;

export const STATUS_KELUARGA_OPTIONS = [
  "SUAMI", "ISTRI", "ANAK", "ORANG TUA", "SAUDARA", "LAINNYA", "N/A",
] as const;

export const PENDIDIKAN_OPTIONS = [
  "TIDAK SEKOLAH", "BELUM SEKOLAH", "SD", "SMP", "SMA",
  "SMK", "D3", "S1", "S2", "S3", "LAINNYA",
] as const;

export const KEWARGANEGARAAN_OPTIONS = ["WNI", "WNA"] as const;

export const HUBUNGAN_KK_OPTIONS = [
  "KEPALA KELUARGA", "SUAMI", "ISTRI", "ANAK", "MENANTU",
  "CUCU", "ORANG TUA", "MERTUA", "SAUDARA", "PEMBANTU", "LAINNYA",
] as const;

export interface ChangeRequestItem {
  id:                string;
  resident_id:       string;
  resident_name:     string;
  requested_by:      string;
  requested_by_name: string;
  field_name:        string;
  field_label:       string;
  old_value:         string | null;
  new_value:         string | null;
  status:            "pending" | "approved" | "rejected";
  reviewed_by_name:  string | null;
  reviewed_at:       string | null;
  rejection_reason:  string | null;
  created_at:        string;
}

export interface ReviewChangeRequestPayload {
  action:            "approve" | "reject";
  rejection_reason?: string;
}

export interface ReviewChangeRequestResponse {
  message:    string;
  request_id: string;
}

/**
 * GET /warga/change-requests/pending
 * Ketua RT review queue — all pending self-edit requests, oldest first.
 */
export const getPendingChangeRequests = async (): Promise<ChangeRequestItem[]> => {
  const { data } = await apiClient.get<ChangeRequestItem[]>(
    "/warga/change-requests/pending"
  );
  return data;
};

/**
 * PATCH /warga/change-requests/{id}/review
 * Approve or reject a single field-change request.
 */
export const reviewChangeRequest = async (
  requestId: string,
  payload:   ReviewChangeRequestPayload,
): Promise<ReviewChangeRequestResponse> => {
  const { data } = await apiClient.patch<ReviewChangeRequestResponse>(
    `/warga/change-requests/${requestId}/review`,
    payload,
  );
  return data;
};

// === ADDED — Tambah Warga =====================================================

export interface AdminCreateResidentPayload {
  full_name:        string;
  phone:            string;
  nik?:             string;
  no_kk?:           string;
  status_keluarga?: string;
  alamat_ktp?:      string;
  alamat_domisili?: string;
}

export interface AdminCreateResidentResponse {
  id:        string;
  full_name: string;
  phone:     string;
  status:    string;
  message:   string;
}

/**
 * POST /warga/admin-create
 * Ketua RT manually adds a warga's data — no login account required.
 * Returns the new resident id + confirmation message.
 */
export const adminCreateResident = async (
  payload: AdminCreateResidentPayload,
): Promise<AdminCreateResidentResponse> => {
  const { data } = await apiClient.post<AdminCreateResidentResponse>(
    "/warga/admin-create",
    payload,
  );
  return data;
};

export interface ImportPreviewRow {
  row:                 number;
  full_name:           string;
  phone:               string;
  nik?:                string;
  no_kk?:              string;
  tanggal_lahir?:      string;
  tempat_lahir?:       string;
  jenis_kelamin?:      string;
  agama?:              string;
  pekerjaan?:          string;
  status_kawin?:       string;
  status_tinggal?:     string;
  status_keluarga?:    string;
  alamat_ktp?:         string;
  alamat_domisili?:    string;
  pendidikan_terakhir?: string;
  kewarganegaraan?:    string;
  hubungan_dengan_kk?: string;
}

export interface ImportPreviewError {
  row:    number;
  field:  string;
  value:  string;
  reason: string;
}

export interface ImportPreviewResponse {
  valid:       ImportPreviewRow[];
  errors:      ImportPreviewError[];
  total_rows:  number;
  valid_count: number;
  error_count: number;
}

export interface ImportConfirmResponse {
  message:     string;
  imported:    number;
  failed:      number;
  failed_rows: { row: number | string; reason: string }[];
}

/**
 * POST /warga/import/preview
 * Upload .xlsx, validate rows, return preview. Nothing saved yet.
 */
export const previewImport = async (
  file: File,
): Promise<ImportPreviewResponse> => {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await apiClient.post<ImportPreviewResponse>(
    "/warga/import/preview",
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data;
};

/**
 * POST /warga/import/confirm
 * Bulk-insert the validated rows from preview. Returns result summary.
 */
export const confirmImport = async (
  rows: ImportPreviewRow[],
): Promise<ImportConfirmResponse> => {
  const { data } = await apiClient.post<ImportConfirmResponse>(
    "/warga/import/confirm",
    { rows },
  );
  return data;
};

/**
 * GET /warga/import/template
 * Triggers download of the RTMudah .xlsx import template.
 */
export const downloadImportTemplate = async (): Promise<void> => {
  const response = await apiClient.get("/warga/import/template", {
    responseType: "blob",
  });
  const url  = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href  = url;
  link.setAttribute("download", "template_import_warga.xlsx");
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

