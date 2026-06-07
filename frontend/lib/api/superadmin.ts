// lib/api/superadmin.ts
// Superadmin onboarding verification API client
//
// EXTENDED from original — all existing exports preserved exactly.
// Added: KTP OCR types + retriggerOCR call.
//
// Wires to:
//   GET  /onboarding/pending                              — existing
//   POST /onboarding/rt-groups/{id}/verify                — existing
//   POST /onboarding/rt-groups/{id}/retrigger-ocr         — NEW

import apiClient from "./client";

// ─── Existing types (unchanged) ───────────────────────────────────────────────

export interface PendingRTGroup {
  id:              string;
  rt_identity:     string;
  admin_full_name: string;
  admin_phone:     string;
  ktp_url:         string | null;
  sk_url:          string | null;
  created_at:      string;
  // New OCR fields — optional so existing queue items without OCR still type-check
  ktp_ocr_confidence?: number | null;
  ktp_ocr_flags?:      KTPFlag[];
  ktp_verified?:       boolean;
  ktp_ocr_data?:       KTPOCRData | null;
}

export interface VerifyRTGroupPayload {
  action:            "approve" | "reject";
  rejection_reason?: string;
}

export interface VerifyRTGroupResponse {
  id:                  string;
  rt_identity:         string;
  verification_status: string;
  verified_at:         string | null;
  verified_by:         string | null;
  rejection_reason:    string | null;
  needs_renewal:       boolean;
  message:             string;
}

// ─── New OCR types ────────────────────────────────────────────────────────────

export type KTPFlag =
  | "nik_format_invalid"
  | "nik_birth_date_mismatch"
  | "name_mismatch"
  | "address_rt_mismatch"
  | "low_ocr_confidence"
  | "image_unreadable"
  | "expired_ktp";

export interface KTPOCRData {
  nik:           string | null;
  nama:          string | null;
  tempat_lahir:  string | null;
  tanggal_lahir: string | null;
  jenis_kelamin: string | null;
  alamat:        string | null;
  rt_rw:         string | null;
  kelurahan:     string | null;
  kecamatan:     string | null;
  kota:          string | null;
  provinsi:      string | null;
  agama:         string | null;
  masa_berlaku:  string | null;
}

export interface OCRRetriggerResponse {
  ocr_success:      boolean;
  confidence_score: number;
  flags:            KTPFlag[];
  suggested_action: "auto_approve_ktp" | "manual_review" | "reject_reupload";
  extracted:        KTPOCRData | null;
}

// ─── API calls (existing preserved, new added) ────────────────────────────────

export const superadminApi = {
  /**
   * GET /onboarding/pending
   * Returns all RT groups awaiting superadmin verification — FIFO queue.
   */
  listPending: async (): Promise<PendingRTGroup[]> => {
    const { data } = await apiClient.get<PendingRTGroup[]>("/onboarding/pending");
    return data;
  },

  /**
   * POST /onboarding/rt-groups/{id}/verify
   * Approve or reject a Ketua RT verification request.
   */
  verifyRTGroup: async (
    rtGroupId: string,
    payload: VerifyRTGroupPayload,
  ): Promise<VerifyRTGroupResponse> => {
    const { data } = await apiClient.post<VerifyRTGroupResponse>(
      `/onboarding/rt-groups/${rtGroupId}/verify`,
      payload,
    );
    return data;
  },

  /**
   * POST /onboarding/rt-groups/{id}/retrigger-ocr
   * Re-run KTP OCR on already-uploaded image (e.g. after Ketua RT reuploads).
   * Superadmin only — token required.
   */
  retriggerOCR: async (rtGroupId: string): Promise<OCRRetriggerResponse> => {
    const { data } = await apiClient.post<OCRRetriggerResponse>(
      `/onboarding/rt-groups/${rtGroupId}/retrigger-ocr`,
    );
    return data;
  },
};

// ─── UI helpers ───────────────────────────────────────────────────────────────

export const KTP_FLAG_LABELS: Record<KTPFlag, string> = {
  nik_format_invalid:      "NIK format tidak valid",
  nik_birth_date_mismatch: "Tanggal lahir NIK tidak cocok",
  name_mismatch:           "Nama tidak cocok dengan registrasi",
  address_rt_mismatch:     "RT/RW/Kelurahan tidak cocok",
  low_ocr_confidence:      "Kualitas foto KTP rendah",
  image_unreadable:        "Foto tidak terbaca",
  expired_ktp:             "KTP sudah kedaluwarsa",
};

export const KTP_FLAG_IS_CRITICAL: Record<KTPFlag, boolean> = {
  nik_format_invalid:      true,
  image_unreadable:        true,
  nik_birth_date_mismatch: false,
  name_mismatch:           false,
  address_rt_mismatch:     false,
  low_ocr_confidence:      false,
  expired_ktp:             false,
};

export function confidenceLabel(score: number | null | undefined): string {
  if (score == null) return "Belum diproses";
  if (score >= 0.8)  return "Tinggi";
  if (score >= 0.5)  return "Sedang";
  return "Rendah";
}

export function confidenceColor(score: number | null | undefined): string {
  if (score == null) return "#9ca3af";
  if (score >= 0.8)  return "#16a34a";
  if (score >= 0.5)  return "#d97706";
  return "#dc2626";
}
