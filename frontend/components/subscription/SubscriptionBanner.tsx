"use client";
// components/subscription/SubscriptionBanner.tsx
//
// Shows contextual banner based on subscription state:
//   trial  (≤3 days left) → amber warning
//   grace                 → red urgent + payment CTA
//   locked                → never shown here (LockScreen handles it)
//   pending payment       → blue info
//
// Placed inside AdminLayout, above <main> content.

import { ANNUAL_PRICE_IDR } from "@/lib/api/subscription";
import { useSubscription } from "@/lib/hooks/useSubscription";
import { AlertCircle, AlertTriangle, CheckCircle, Clock, X } from "lucide-react";
import { useState } from "react";

interface SubscriptionBannerProps {
  onPayClick: () => void;
}

export function SubscriptionBanner({ onPayClick }: SubscriptionBannerProps) {
  const {
    status, accessLevel, isTrial, isGrace,
    hasPending, daysLeft, daysUntilLocked,
  } = useSubscription();

  const [dismissed, setDismissed] = useState(false);

  // Nothing to show for full access (unless trial ending soon)
  if (!status || accessLevel === "locked") return null;
  if (accessLevel === "full" && !isTrial) return null;
  // if (accessLevel === "full" && isTrial && (daysLeft ?? 99) > 3) return null;
  if (dismissed) return null;

  // ── Pending payment — show confirmation waiting state ─────────────────
  if (hasPending) {
    return (
      <div className="bg-blue-50 border-b border-blue-200 px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <p className="text-sm text-blue-800">
            <span className="font-semibold">Bukti bayar diterima</span> — menunggu konfirmasi dari tim RTMudah.
            Biasanya dikonfirmasi dalam 1×24 jam.
          </p>
        </div>
        <button onClick={() => setDismissed(true)} className="text-blue-400 hover:text-blue-600 flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // ── Grace period — urgent, payment required ───────────────────────────
  if (isGrace) {
    const daysText = daysUntilLocked !== null
      ? daysUntilLocked === 0
        ? "Hari ini akses dikunci!"
        : `${daysUntilLocked} hari lagi akses dikunci`
      : "Akses akan segera dikunci";

    return (
      <div className="bg-red-50 border-b border-red-200 px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <div>
            <p className="text-sm text-red-800 font-semibold">
              Langganan RTMudah Anda telah berakhir
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              {daysText} — segera bayar Rp 400.000 untuk melanjutkan akses penuh.
            </p>
          </div>
        </div>
        <button
          onClick={onPayClick}
          className="flex-shrink-0 bg-red-600 hover:bg-red-700 text-white text-xs
            font-semibold px-4 py-2 rounded-lg transition-colors active:scale-95"
        >
          Bayar Sekarang →
        </button>
      </div>
    );
  }

  // ── Trial ending soon (≤3 days) ───────────────────────────────────────
  if (isTrial && daysLeft !== null && daysLeft <= 3) {
    const daysText = daysLeft === 0
      ? "Trial berakhir hari ini!"
      : `Trial berakhir dalam ${daysLeft} hari`;

    return (
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <div>
            <p className="text-sm text-amber-800 font-semibold">{daysText}</p>
            <p className="text-xs text-amber-600 mt-0.5">
              Setelah trial berakhir, ada masa tenggang 14 hari sebelum akses dikunci.
              Bayar sekarang untuk akses tanpa gangguan.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setDismissed(true)}
            className="text-amber-400 hover:text-amber-600"
          >
            <X className="w-4 h-4" />
          </button>
          <button
            onClick={onPayClick}
            className="bg-amber-600 hover:bg-amber-700 text-white text-xs
              font-semibold px-4 py-2 rounded-lg transition-colors active:scale-95"
          >
            Bayar Sekarang →
          </button>
        </div>
      </div>
    );
  }

  // ── Trial info (>3 days left) — shown briefly then dismissed ─────────
  if (isTrial) {
    return (
      <div className="bg-green-50 border-b border-green-200 px-4 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
          <p className="text-xs text-green-800">
            <span className="font-semibold">Trial aktif</span> — {daysLeft} hari tersisa.
            Setelah trial, langganan tahunan Rp {(ANNUAL_PRICE_IDR / 1000).toFixed(0)}rb/tahun.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={onPayClick}
          className="text-xs font-semibold text-green-700 hover:text-green-900
            bg-green-100 hover:bg-green-200 px-3 py-1.5 rounded-lg transition-colors"
        >
          Bayar Sekarang
        </button>
        <button onClick={() => setDismissed(true)} className="text-green-400 hover:text-green-600">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      </div>
    );
  }

  return null;
}
