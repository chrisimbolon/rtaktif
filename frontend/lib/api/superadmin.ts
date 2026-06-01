// lib/api/superadmin.ts
// Superadmin onboarding verification API client
// Wires to:
//   GET  /onboarding/pending
//   POST /onboarding/rt-groups/{id}/verify

import apiClient from "./client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PendingRTGroup {
  id:              string;
  rt_identity:     string;
  admin_full_name: string;
  admin_phone:     string;
  ktp_url:         string | null;
  sk_url:          string | null;
  created_at:      string;
}

export interface VerifyRTGroupPayload {
  action:           "approve" | "reject";
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

// ─── API calls ────────────────────────────────────────────────────────────────

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
};
