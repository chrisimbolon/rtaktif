/**
 * lib/api/onboarding.ts
 *
 * API client for the Ketua RT onboarding flow:
 *   POST /onboarding/upload-document   multipart/form-data  → { url: string }
 *   POST /onboarding/submit-verification                    → { status: string }
 *
 * Why a separate module (not in auth.ts)?
 *   - File uploads have very different error handling (size, type, network)
 *   - The onboarding endpoints are unauthenticated at submission time
 *     (user just registered, no JWT cookie yet — backend uses user_id param)
 *   - Keeps auth.ts clean and single-purpose
 */

import { apiClient } from "@/lib/api/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UploadDocumentResponse {
  url:       string;
  file_name: string;
  size_bytes: number;
}

export interface SubmitVerificationPayload {
  user_id:        string;
  ktp_url:        string;
  sk_url:         string;
  signature_data: string;   // base64 PNG from canvas.toDataURL()
  rt_number:      string;
  rw_number:      string;
  kelurahan:      string;
  kecamatan:      string;
  kota:           string;
}

export interface SubmitVerificationResponse {
  status:  "pending_verification";
  message: string;
}

// ─── Client ───────────────────────────────────────────────────────────────────

export const onboardingApi = {
  /**
   * Upload a single document (KTP or SK) as multipart form.
   * Returns the permanent storage URL for later use in submitVerification.
   *
   * Max file size validation (10 MB) is intentionally done client-side
   * before the network call — fail fast, better UX.
   */
  uploadDocument: async (
    file: File,
    type: "ktp" | "sk",
  ): Promise<UploadDocumentResponse> => {
    const MAX_BYTES = 10 * 1024 * 1024;   // 10 MB
    if (file.size > MAX_BYTES) {
      throw new Error("Ukuran file maksimal 10 MB");
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      throw new Error("Format file tidak didukung. Gunakan JPG, PNG, WebP, atau PDF.");
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("document_type", type);

    const { data } = await apiClient.post<UploadDocumentResponse>(
      "/onboarding/upload-document",
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
        // Track upload progress for future progress bar enhancement
        onUploadProgress: (progressEvent) => {
          const pct = progressEvent.total
            ? Math.round((progressEvent.loaded / progressEvent.total) * 100)
            : 0;
          // Emit to a custom event so the UI can react without prop drilling
          window.dispatchEvent(new CustomEvent("upload-progress", { detail: { type, pct } }));
        },
      },
    );

    return data;
  },

  /**
   * Submit the complete onboarding package:
   *   - KTP URL (from uploadDocument)
   *   - SK URL (from uploadDocument)
   *   - Signature PNG (base64, from canvas)
   *   - RT identity fields
   *
   * The backend creates the RTGroup in pending_verification state
   * and fires the RTGroupCreated domain event.
   */
  submitVerification: async (
    payload: SubmitVerificationPayload,
  ): Promise<SubmitVerificationResponse> => {
    const { data } = await apiClient.post<SubmitVerificationResponse>(
      "/onboarding/submit-verification",
      payload,
    );
    return data;
  },
};
