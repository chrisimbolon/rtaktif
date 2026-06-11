"use client";
// components/subscription/PaymentModal.tsx
// Full payment flow modal:
//   1. Shows bank transfer instructions (fixed Rp 450.000)
//   2. Drag & drop / click to upload bukti bayar
//   3. Optional notes
//   4. Submit → pending confirmation
//   5. Success state with instructions

import { ANNUAL_PRICE_IDR } from "@/lib/api/subscription";
import { useSubscription } from "@/lib/hooks/useSubscription";
import {
  CheckCircle,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

// ── Bank details — update these with your actual bank info ────────────────
const BANK_INFO = {
  bank:    "BCA",
  account: "1234567890",
  name:    "PT Langit Strategi Indonesia",
  amount:  ANNUAL_PRICE_IDR,
};

// ── File drop zone ────────────────────────────────────────────────────────
function FileDropZone({
  file,
  preview,
  onChange,
}: {
  file?:    File | null;
  preview?: string | null;
  onChange: (f: File) => void;
}) {
  const inputRef        = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith("image/")) onChange(f);
  }, [onChange]);

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={handleDrop}
      className={`
        border-2 border-dashed rounded-xl cursor-pointer transition-all
        ${drag ? "border-orange-400 bg-orange-50" : "border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100"}
        ${preview ? "p-2" : "p-8"}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onChange(f); }}
      />
      {preview ? (
        <div className="text-center">
          <img src={preview} alt="Preview" className="w-full max-h-48 object-contain rounded-lg mx-auto" />
          <p className="text-xs text-gray-400 mt-2 font-mono">{file?.name} — klik untuk ganti</p>
        </div>
      ) : (
        <div className="text-center">
          <Upload className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-700">Klik atau seret foto di sini</p>
          <p className="text-xs text-gray-400 mt-1">JPG, PNG — bukti transfer bank</p>
        </div>
      )}
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────
interface PaymentModalProps {
  onClose: () => void;
}

export function PaymentModal({ onClose }: PaymentModalProps) {
  const { submitPayment, isSubmitting, hasPending } = useSubscription();

  const [step,    setStep]    = useState<"info" | "upload" | "success">(
    hasPending ? "success" : "info"
  );
  const [file,    setFile]    = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [notes,   setNotes]   = useState("");
  const [error,   setError]   = useState("");

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setError("");
  }, []);

  const handleSubmit = async () => {
    if (!file) {
      setError("Bukti transfer wajib diupload.");
      return;
    }
    setError("");

    // In production: upload file to storage first, get URL back
    // For now we use a placeholder URL — replace with real upload
    // e.g: const url = await uploadToStorage(file);
    const placeholderUrl = `bukti_${Date.now()}_${file.name}`;

    try {
      await submitPayment({
        plan:            "annual",
        bukti_bayar_url: placeholderUrl,
        notes:           notes.trim() || undefined,
      });
      setStep("success");
      toast.success("Bukti pembayaran berhasil dikirim!");
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const msg    = typeof detail === "string" ? detail : "Gagal mengirim pembayaran. Coba lagi.";
      setError(msg);
      toast.error(msg);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center
        justify-center z-50 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md my-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900 text-lg">
              {step === "success" ? "Pembayaran Dikirim ✓" : "Perpanjang Langganan"}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">RTMudah — Paket Tahunan</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* ── SUCCESS STATE ── */}
          {step === "success" && (
            <div className="text-center py-4 space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <p className="font-bold text-gray-900 text-lg">Bukti bayar diterima!</p>
                <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                  Tim RTMudah akan memverifikasi pembayaran Anda dalam <strong>1×24 jam</strong>.
                  Akses penuh akan aktif setelah konfirmasi.
                </p>
              </div>
              <div className="bg-blue-50 rounded-xl p-4 text-left">
                <p className="text-xs font-semibold text-blue-800 mb-1">Yang perlu Anda lakukan:</p>
                <ul className="text-xs text-blue-700 space-y-1">
                  <li>✓ Simpan bukti transfer sebagai referensi</li>
                  <li>✓ Tunggu konfirmasi via WhatsApp dari tim kami</li>
                  <li>✓ Jika belum dikonfirmasi lebih dari 24 jam, hubungi support</li>
                </ul>
              </div>
              <button
                onClick={onClose}
                className="w-full py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm font-semibold text-gray-700 transition-colors"
              >
                Tutup
              </button>
            </div>
          )}

          {/* ── INFO STATE — bank transfer instructions ── */}
          {step === "info" && (
            <>
              {/* Price callout */}
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
                <p className="text-xs text-orange-600 font-medium mb-1">Total Pembayaran</p>
                <p className="text-3xl font-extrabold text-orange-700">
                  Rp {ANNUAL_PRICE_IDR.toLocaleString("id-ID")}
                </p>
                <p className="text-xs text-orange-500 mt-1">Langganan tahunan · 1 tahun penuh</p>
              </div>

              {/* Bank details */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Rekening Tujuan</p>
                <div className="space-y-2">
                  {[
                    { label: "Bank",       value: BANK_INFO.bank    },
                    { label: "No. Rekening", value: BANK_INFO.account },
                    { label: "Atas Nama",  value: BANK_INFO.name    },
                    { label: "Jumlah",     value: `Rp ${BANK_INFO.amount.toLocaleString("id-ID")}` },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">{label}</span>
                      <span className="text-xs font-bold text-gray-800 font-mono">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <p className="text-xs text-amber-800">
                  ⚠️ Transfer <strong>tepat</strong> Rp {ANNUAL_PRICE_IDR.toLocaleString("id-ID")} — jumlah berbeda
                  memperlambat konfirmasi.
                </p>
              </div>

              <button
                onClick={() => setStep("upload")}
                className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-700
                  text-white text-sm font-semibold transition-colors active:scale-[0.98]"
              >
                Sudah Transfer → Upload Bukti
              </button>
            </>
          )}

          {/* ── UPLOAD STATE — bukti bayar ── */}
          {step === "upload" && (
            <>
              <button
                onClick={() => setStep("info")}
                className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
              >
                ← Kembali ke info transfer
              </button>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Foto Bukti Transfer *
                </label>
                <FileDropZone file={file} preview={preview} onChange={handleFile} />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Catatan (opsional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="contoh: transfer dari BCA a/n Budi Santoso"
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm
                    bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-200
                    focus:border-orange-400 resize-none transition-all"
                />
              </div>

              {error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200
                  rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !file}
                className={`w-full py-3 rounded-xl text-sm font-semibold flex items-center
                  justify-center gap-2 transition-all active:scale-[0.98]
                  ${file && !isSubmitting
                    ? "bg-orange-600 hover:bg-orange-700 text-white"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                  }`}
              >
                {isSubmitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Mengirim…</>
                ) : (
                  <><CheckCircle className="w-4 h-4" /> Kirim Bukti Bayar</>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
