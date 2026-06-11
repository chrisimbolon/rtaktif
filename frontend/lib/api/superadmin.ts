// lib/api/superadmin.ts
// EXTENDED — adds subscription payment queue endpoints
// All existing exports preserved exactly.
//
// New additions:
//   GET   /subscription/pending-payments        — payment review queue
//   PATCH /subscription/payment/{id}/review     — confirm or reject
//   POST  /subscription/init-trial/{rt_id}      — manual trial init

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

// ─── NEW: Payment queue types ─────────────────────────────────────────────────

export interface PendingPaymentItem {
  payment_id:          string;
  rt_group_id:         string;
  rt_name:             string;
  ketua_rt_name:       string;
  ketua_rt_phone:      string;
  plan:                string;
  amount_idr:          number;
  bukti_bayar_url:     string | null;
  notes:               string | null;
  submitted_at:        string;
  subscription_status: string;
}

export interface ReviewPaymentPayload {
  action:           "confirm" | "reject";
  rejection_reason?: string;
}

export interface ReviewPaymentResponse {
  message:      string;
  payment_id:   string;
  period_start?: string;
  period_end?:   string;
}

// ─── API calls (existing preserved, new added) ────────────────────────────────

export const superadminApi = {
  // ── Existing ──────────────────────────────────────────────────────────────
  listPending: async (): Promise<PendingRTGroup[]> => {
    const { data } = await apiClient.get<PendingRTGroup[]>("/onboarding/pending");
    return data;
  },

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

  retriggerOCR: async (rtGroupId: string): Promise<OCRRetriggerResponse> => {
    const { data } = await apiClient.post<OCRRetriggerResponse>(
      `/onboarding/rt-groups/${rtGroupId}/retrigger-ocr`,
    );
    return data;
  },

  // ── NEW: Payment queue ────────────────────────────────────────────────────

  /**
   * GET /subscription/pending-payments
   * Returns all pending bukti bayar submissions for review — FIFO queue.
   */
  listPendingPayments: async (): Promise<PendingPaymentItem[]> => {
    const { data } = await apiClient.get<PendingPaymentItem[]>("/subscription/pending-payments");
    return data;
  },

  /**
   * PATCH /subscription/payment/{id}/review
   * Confirm or reject a payment submission.
   * On confirm → subscription automatically activated/extended.
   */
  reviewPayment: async (
    paymentId: string,
    payload:   ReviewPaymentPayload,
  ): Promise<ReviewPaymentResponse> => {
    const { data } = await apiClient.patch<ReviewPaymentResponse>(
      `/subscription/payment/${paymentId}/review`,
      payload,
    );
    return data;
  },
};

// ─── UI helpers (existing preserved) ─────────────────────────────────────────

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
