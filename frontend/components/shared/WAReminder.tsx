"use client";
// components/shared/WAReminder.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Option A: Ketua RT just clicks a button — no setup, no config, no API keys
// RTMudah handles everything behind the scenes via Fonnte
// ─────────────────────────────────────────────────────────────────────────────
import { useState }    from "react";
import { useMutation } from "@tanstack/react-query";
import { toast }       from "sonner";
import {
  Send, Loader2, CheckCircle,
  XCircle, MessageCircle, X,
} from "lucide-react";
import { sendTagihanReminder, sendBroadcast } from "@/lib/api/whatsapp";

// ── Shared Result Modal ───────────────────────────────────────────────────────
function ResultModal({
  sent, failed, message, onClose,
}: {
  sent: number; failed: number; message: string; onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-5xl mb-4">{sent > 0 ? "📱" : "⚠️"}</div>
        <h3 className="text-lg font-extrabold text-gray-900 mb-2">
          {sent > 0 ? "Pesan Terkirim!" : "Pesan Gagal"}
        </h3>

        <div className="flex justify-center gap-8 my-5">
          <div className="text-center">
            <div className="text-3xl font-extrabold text-green-700">{sent}</div>
            <div className="text-xs text-gray-500 mt-1 flex items-center
              gap-1 justify-center">
              <CheckCircle className="w-3 h-3 text-green-500" />
              Terkirim
            </div>
          </div>
          {failed > 0 && (
            <div className="text-center">
              <div className="text-3xl font-extrabold text-red-600">{failed}</div>
              <div className="text-xs text-gray-500 mt-1 flex items-center
                gap-1 justify-center">
                <XCircle className="w-3 h-3 text-red-500" />
                Gagal
              </div>
            </div>
          )}
        </div>

        <p className="text-sm text-gray-500 mb-5">{message}</p>

        {failed > 0 && (
          <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-2 mb-4">
            ⚠️ Warga yang gagal kemungkinan belum mendaftarkan nomor HP.
          </p>
        )}

        <button
          onClick={onClose}
          className="w-full py-3 bg-gray-900 text-white rounded-xl text-sm
            font-bold hover:bg-gray-700 transition-colors"
        >
          Tutup
        </button>
      </div>
    </div>
  );
}

// ── Tagihan Reminder Button ───────────────────────────────────────────────────
// One-click: sends personalized reminders to all unpaid warga
// No phone numbers needed — server fetches them automatically

export function WATagihanReminderButton({
  rtGroupId,
  year,
  month,
  unpaidCount,
  className = "",
}: {
  rtGroupId:   string;
  year:        number;
  month:       number;
  unpaidCount: number;
  className?:  string;
}) {
  const [result, setResult] = useState<{
    sent: number; failed: number; message: string;
  } | null>(null);

  const mutation = useMutation({
    mutationFn: () => sendTagihanReminder(rtGroupId, year, month),
    onSuccess: (data) => {
      setResult({
        sent:    data.sent,
        failed:  data.failed,
        message: data.message,
      });
      if (data.sent > 0) {
        toast.success(`✅ Reminder WA terkirim ke ${data.sent} warga!`);
      } else {
        toast.info(data.message);
      }
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail ?? "Gagal mengirim reminder WA";
      toast.error(msg);
    },
  });

  // Don't render if no unpaid
  if (unpaidCount === 0) return null;

  return (
    <>
      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        title={`Kirim reminder WA ke ${unpaidCount} warga yang belum bayar`}
        className={`flex items-center gap-2 px-4 py-2 bg-green-600
          hover:bg-green-500 text-white rounded-lg text-sm font-bold
          disabled:opacity-60 disabled:cursor-not-allowed
          transition-all shadow-sm ${className}`}
      >
        {mutation.isPending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Mengirim...
          </>
        ) : (
          <>
            <Send className="w-3.5 h-3.5" />
            Reminder WA
            <span className="bg-white/25 text-white text-xs font-extrabold
              px-1.5 py-0.5 rounded-full">
              {unpaidCount}
            </span>
          </>
        )}
      </button>

      {result && (
        <ResultModal {...result} onClose={() => setResult(null)} />
      )}
    </>
  );
}

// ── Broadcast Button ──────────────────────────────────────────────────────────
// Ketua RT writes title + message → sent to ALL active warga
// Server auto-fetches phone numbers — zero config for Ketua RT

export function WABroadcastButton({
  rtGroupId,
  wargaCount,
  className = "",
}: {
  rtGroupId:  string;
  wargaCount: number;
  className?: string;
}) {
  const [showModal, setShowModal] = useState(false);
  const [title,     setTitle]     = useState("");
  const [content,   setContent]   = useState("");
  const [result,    setResult]    = useState<{
    sent: number; failed: number; message: string;
  } | null>(null);

  const mutation = useMutation({
    mutationFn: () => sendBroadcast(rtGroupId, title, content),
    onSuccess: (data) => {
      setResult({
        sent:    data.sent,
        failed:  data.failed,
        message: data.message,
      });
      setShowModal(false);
      setTitle("");
      setContent("");
      toast.success(`✅ Broadcast terkirim ke ${data.sent} warga!`);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? "Gagal mengirim broadcast");
    },
  });

  const canSend = title.trim().length > 0 && content.trim().length > 0;

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        title="Broadcast pesan ke semua warga"
        className={`flex items-center gap-2 px-4 py-2 bg-blue-600
          hover:bg-blue-500 text-white rounded-lg text-sm font-bold
          transition-all shadow-sm ${className}`}
      >
        <MessageCircle className="w-3.5 h-3.5" />
        Broadcast WA
      </button>

      {/* Broadcast compose modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center
          justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">

            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-100 flex
              items-start justify-between">
              <div>
                <h3 className="font-extrabold text-gray-900">
                  Broadcast WhatsApp
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  Pesan akan dikirim ke{" "}
                  <span className="font-semibold text-blue-700">
                    {wargaCount} warga aktif
                  </span>
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Judul Pengumuman <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Contoh: Kerja Bakti Minggu Ini"
                  maxLength={100}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200
                    bg-gray-50 text-sm focus:outline-none focus:ring-2
                    focus:ring-blue-100 focus:border-blue-400 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Isi Pesan <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  rows={5}
                  placeholder={
                    "Contoh:\nKerja bakti dilaksanakan Minggu, 1 Juni 2026\n" +
                    "pukul 07.00 WIB di lapangan RT.\n\n" +
                    "Mohon kehadiran seluruh KK."
                  }
                  maxLength={500}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200
                    bg-gray-50 text-sm focus:outline-none focus:ring-2
                    focus:ring-blue-100 focus:border-blue-400 transition-colors
                    resize-none"
                />
                <p className="text-xs text-gray-400 mt-1 text-right">
                  {content.length}/500 karakter
                </p>
              </div>

              {/* Live preview */}
              {canSend && (
                <div className="bg-green-50 border border-green-200
                  rounded-xl p-4">
                  <p className="text-xs font-bold text-green-700 mb-2 flex
                    items-center gap-1">
                    📱 Preview pesan WA:
                  </p>
                  <div className="bg-white rounded-lg p-3 text-xs
                    text-gray-700 leading-relaxed whitespace-pre-wrap
                    border border-green-100">
                    {`📢 *${title}*\n\n${content}\n\n_Pesan otomatis dari RTMudah_`}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => {
                  setShowModal(false);
                  setTitle("");
                  setContent("");
                }}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200
                  text-sm font-semibold text-gray-700 hover:bg-gray-50
                  transition-colors"
              >
                Batal
              </button>
              <button
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending || !canSend}
                className="flex-1 flex items-center justify-center gap-2
                  px-4 py-2.5 rounded-xl bg-green-600 text-white text-sm
                  font-bold hover:bg-green-500 disabled:opacity-60
                  disabled:cursor-not-allowed transition-colors"
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Mengirim...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Kirim ke {wargaCount} Warga
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {result && (
        <ResultModal {...result} onClose={() => setResult(null)} />
      )}
    </>
  );
}
