// lib/api/subscription.ts
// RTMudah subscription API — annual plan Rp 400.000/tahun

import apiClient from "./client";

// ── Types ──────────────────────────────────────────────────────────────────

export interface SubscriptionStatus {
  rt_group_id:        string;
  plan:               string;
  status:             "trial" | "active" | "grace" | "locked" | "cancelled";
  access_level:       "full" | "grace" | "locked";
  trial_ends_at:      string | null;
  current_period_end: string | null;
  grace_ends_at:      string | null;
  days_until_expiry:  number | null;
  days_until_locked:  number | null;
  pending_payment:    boolean;
}

export interface PaymentRecord {
  id:               string;
  rt_group_id:      string;
  plan:             string;
  amount_idr:       number;
  status:           "pending" | "confirmed" | "rejected";
  bukti_bayar_url:  string | null;
  notes:            string | null;
  period_start:     string | null;
  period_end:       string | null;
  confirmed_by:     string | null;
  confirmed_at:     string | null;
  rejection_reason: string | null;
  created_at:       string;
}

export interface SubmitPaymentPayload {
  plan:            "annual";
  bukti_bayar_url: string | null;
  notes?:          string;
}

// ── API calls ──────────────────────────────────────────────────────────────

export const getMySubscriptionStatus = async (): Promise<SubscriptionStatus> => {
  const { data } = await apiClient.get<SubscriptionStatus>("/subscription/my-status");
  return data;
};

export const submitPayment = async (
  payload: SubmitPaymentPayload
): Promise<PaymentRecord> => {
  const { data } = await apiClient.post<PaymentRecord>("/subscription/payment", payload);
  return data;
};

export const getMyPayments = async (): Promise<PaymentRecord[]> => {
  const { data } = await apiClient.get<PaymentRecord[]>("/subscription/payments");
  return data;
};

// ── Helpers ────────────────────────────────────────────────────────────────

export const formatSubscriptionStatus = (status: SubscriptionStatus["status"]): string => {
  const labels: Record<string, string> = {
    trial:     "Trial",
    active:    "Aktif",
    grace:     "Masa Tenggang",
    locked:    "Terkunci",
    cancelled: "Dibatalkan",
  };
  return labels[status] ?? status;
};

export const ANNUAL_PRICE_IDR = 400_000;
