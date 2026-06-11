"use client";
// components/subscription/LockScreen.tsx
//
// Full-page overlay shown when access_level === "locked"
// Login still works — they see this instead of any content.
// Shows payment button to reactivate.

import { ANNUAL_PRICE_IDR } from "@/lib/api/subscription";
import { useSubscription } from "@/lib/hooks/useSubscription";
import { Lock } from "lucide-react";

interface LockScreenProps {
  onPayClick: () => void;
}

export function LockScreen({ onPayClick }: LockScreenProps) {
  const { hasPending } = useSubscription();

  return (
    <div className="fixed inset-0 bg-gray-950/95 backdrop-blur-sm z-40 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md text-center p-8 space-y-6">

        {/* Lock icon */}
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
          <Lock className="w-10 h-10 text-red-500" />
        </div>

        {/* Message */}
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-gray-900">Akses Dikunci</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            Masa tenggang langganan RTMudah Anda telah berakhir.
            Data Anda <strong className="text-gray-700">aman dan tidak dihapus</strong> —
            aktifkan kembali untuk melanjutkan.
          </p>
        </div>

        {/* Price reminder */}
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Biaya reaktivasi</p>
          <p className="text-2xl font-extrabold text-gray-900">
            Rp {ANNUAL_PRICE_IDR.toLocaleString("id-ID")}
          </p>
          <p className="text-xs text-gray-400 mt-1">Langganan tahunan penuh · 365 hari</p>
        </div>

        {hasPending ? (
          // Already submitted payment — waiting for confirmation
          <div className="space-y-3">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-blue-800">Pembayaran sedang diverifikasi</p>
              <p className="text-xs text-blue-600 mt-1">
                Tim RTMudah sedang memproses bukti transfer Anda.
                Biasanya selesai dalam 1×24 jam.
              </p>
            </div>
            <p className="text-xs text-gray-400">
              Butuh bantuan? WhatsApp:{" "}
              <a
                href="https://wa.me/6281234567890"
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange-600 font-semibold hover:underline"
              >
                +62 812-3456-7890
              </a>
            </p>
          </div>
        ) : (
          // No pending payment — show pay button
          <div className="space-y-3">
            <button
              onClick={onPayClick}
              className="w-full py-4 rounded-xl bg-orange-600 hover:bg-orange-700
                text-white font-bold text-base transition-colors active:scale-[0.98]"
            >
              Aktifkan Sekarang →
            </button>
            <p className="text-xs text-gray-400">
              Butuh bantuan? WhatsApp:{" "}
              <a
                href="https://wa.me/6281234567890"
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange-600 font-semibold hover:underline"
              >
                +62 812-3456-7890
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
