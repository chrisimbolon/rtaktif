"use client";

/**
 * app/(admin)/superadmin/pembayaran/page.tsx
 *
 * Superadmin payment review queue.
 * Shows all pending bukti bayar submissions — confirm or reject each one.
 *
 * Wires to:
 *   GET   /subscription/pending-payments
 *   PATCH /subscription/payment/{id}/review
 *
 * Design matches existing superadmin pages (verifikasi.tsx pattern).
 */

import {
  superadminApi,
  type PendingPaymentItem,
  type ReviewPaymentPayload,
} from "@/lib/api/superadmin";
import { useAuth } from "@/lib/hooks/useAuth";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BanknoteIcon,
  CheckCircle,
  Clock,
  ExternalLink,
  Loader2,
  Phone,
  RefreshCw,
  User,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterState = "pending" | "confirmed" | "rejected" | "all";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRupiah(amount: number): string {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day:    "numeric",
    month:  "long",
    year:   "numeric",
    hour:   "2-digit",
    minute: "2-digit",
  });
}

function SubscriptionStatusBadge({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    trial:     "bg-blue-100   text-blue-700   border-blue-200",
    active:    "bg-green-100  text-green-700  border-green-200",
    grace:     "bg-amber-100  text-amber-700  border-amber-200",
    locked:    "bg-red-100    text-red-700    border-red-200",
    cancelled: "bg-gray-100   text-gray-600   border-gray-200",
  };
  const labels: Record<string, string> = {
    trial:     "Trial",
    active:    "Aktif",
    grace:     "Masa Tenggang",
    locked:    "Terkunci",
    cancelled: "Dibatalkan",
  };
  return (
    <span className={cn(
      "text-xs px-2 py-0.5 rounded-full font-medium border",
      cfg[status] ?? "bg-gray-100 text-gray-600 border-gray-200"
    )}>
      {labels[status] ?? status}
    </span>
  );
}

function RTAvatar({ name }: { name: string }) {
  const initials = (name || "R")
    .split(" ").slice(0, 2)
    .map((n: string) => n[0])
    .join("").toUpperCase();
  return (
    <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center
                    text-white text-sm font-bold flex-shrink-0">
      {initials}
    </div>
  );
}

// ─── Reject Modal ─────────────────────────────────────────────────────────────

interface RejectModalProps {
  payment:   PendingPaymentItem;
  onClose:   () => void;
  onReject:  (reason: string) => void;
  isPending: boolean;
}

function RejectModal({ payment, onClose, onReject, isPending }: RejectModalProps) {
  const [reason, setReason] = useState("");
  const MIN_CHARS = 10;
  const valid = reason.trim().length >= MIN_CHARS;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-700 rounded-2xl p-6
                      w-full max-w-md shadow-2xl">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20
                          flex items-center justify-center">
            <XCircle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 className="text-white font-semibold">Tolak Pembayaran</h3>
            <p className="text-gray-400 text-xs mt-0.5">{payment.rt_name}</p>
          </div>
        </div>

        <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20
                        rounded-xl p-3 mb-4">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-amber-300 text-xs">
            Ketua RT akan diberi tahu alasan penolakan dan dapat mengupload
            bukti bayar ulang.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Alasan Penolakan <span className="text-red-400 ml-1">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Contoh: Bukti transfer tidak jelas, nominal tidak sesuai, atau transfer dari rekening berbeda..."
            rows={4}
            className={cn(
              "w-full px-4 py-3 rounded-xl bg-gray-800 border text-white text-sm",
              "placeholder:text-gray-600 resize-none focus:outline-none focus:ring-2",
              valid
                ? "border-gray-600 focus:border-red-500 focus:ring-red-500/20"
                : "border-gray-700 focus:border-red-500 focus:ring-red-500/20",
            )}
          />
          <p className={cn(
            "text-xs mt-1.5 text-right",
            valid ? "text-gray-500" : "text-red-400"
          )}>
            {reason.trim().length} / {MIN_CHARS} karakter minimum
          </p>
        </div>

        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
            disabled={isPending}
            className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-300
                       text-sm hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            Batal
          </button>
          <button
            onClick={() => onReject(reason.trim())}
            disabled={!valid || isPending}
            className={cn(
              "flex-1 py-2.5 rounded-xl text-sm font-medium transition-all",
              valid && !isPending
                ? "bg-red-500 hover:bg-red-400 text-white"
                : "bg-gray-800 text-gray-600 cursor-not-allowed",
            )}
          >
            {isPending ? "Menolak…" : "Tolak Pembayaran"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Bukti Bayar Viewer ───────────────────────────────────────────────────────

function BuktiBayarViewer({ url }: { url: string | null }) {
  const [open, setOpen] = useState(false);

  if (!url) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-xl border border-gray-200
                      bg-gray-50 text-gray-400 text-sm">
        <BanknoteIcon className="w-4 h-4" />
        <span>Bukti belum diupload</span>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 p-3 rounded-xl border border-blue-200
                   bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100
                   transition-colors"
      >
        <BanknoteIcon className="w-4 h-4 flex-shrink-0" />
        <span>Lihat Bukti Transfer</span>
        <ExternalLink className="w-3.5 h-3.5 ml-auto flex-shrink-0" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center
                     justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <p className="font-semibold text-gray-900 text-sm">Bukti Transfer</p>
              <div className="flex items-center gap-2">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                >
                  Buka di tab baru <ExternalLink className="w-3 h-3" />
                </a>
                <button
                  onClick={() => setOpen(false)}
                  className="text-gray-400 hover:text-gray-600 ml-2 text-lg leading-none"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="p-4">
              <img
                src={url}
                alt="Bukti Transfer"
                className="w-full rounded-xl object-contain max-h-[60vh]"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              <p className="text-xs text-gray-400 mt-3 font-mono break-all">{url}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Payment Card ─────────────────────────────────────────────────────────────

interface PaymentCardProps {
  payment:   PendingPaymentItem;
  onConfirm: (payment: PendingPaymentItem) => void;
  onReject:  (payment: PendingPaymentItem) => void;
  isLoading: boolean;
}

function PaymentCard({ payment, onConfirm, onReject, isLoading }: PaymentCardProps) {
  const submittedDate = formatDate(payment.submitted_at);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden
                    hover:shadow-md transition-shadow">

      {/* Card header */}
      <div className="bg-gray-900 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <RTAvatar name={payment.ketua_rt_name} />
            <div>
              <p className="text-white font-semibold text-sm">{payment.rt_name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Clock className="w-3 h-3 text-gray-400" />
                <span className="text-gray-400 text-xs">{submittedDate}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span className="flex-shrink-0 px-2.5 py-1 rounded-full bg-amber-500/10
                             border border-amber-500/20 text-amber-400 text-xs font-medium">
              Menunggu
            </span>
            <SubscriptionStatusBadge status={payment.subscription_status} />
          </div>
        </div>
      </div>

      {/* Card body */}
      <div className="p-5 space-y-4">

        {/* Ketua RT info */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              <User className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-400">Ketua RT</p>
              <p className="text-sm font-medium text-gray-900 truncate">
                {payment.ketua_rt_name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
              <Phone className="w-3.5 h-3.5 text-green-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-400">Nomor HP</p>
              <a
                href={`https://wa.me/62${payment.ketua_rt_phone?.replace(/^0/, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-green-700 hover:underline truncate block"
              >
                {payment.ketua_rt_phone || "—"}
              </a>
            </div>
          </div>
        </div>

        {/* Payment amount */}
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3
                        flex items-center justify-between">
          <div>
            <p className="text-xs text-orange-600 font-medium">Jumlah Pembayaran</p>
            <p className="text-xl font-extrabold text-orange-700 mt-0.5">
              {formatRupiah(payment.amount_idr)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-orange-500">Paket</p>
            <p className="text-sm font-semibold text-orange-700 capitalize mt-0.5">
              {payment.plan === "annual" ? "Tahunan" : payment.plan}
            </p>
          </div>
        </div>

        {/* Bukti bayar */}
        <BuktiBayarViewer url={payment.bukti_bayar_url} />

        {/* Notes from Ketua RT */}
        {payment.notes && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-400 font-medium mb-1">Catatan dari Ketua RT</p>
            <p className="text-sm text-gray-700 leading-relaxed">{payment.notes}</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            onClick={() => onReject(payment)}
            disabled={isLoading}
            className="flex items-center justify-center gap-2 py-2.5 rounded-xl
                       border border-red-200 text-red-600 text-sm font-medium
                       hover:bg-red-50 transition-colors disabled:opacity-50
                       disabled:cursor-not-allowed active:scale-[0.98]"
          >
            <XCircle className="w-4 h-4" />
            Tolak
          </button>
          <button
            onClick={() => onConfirm(payment)}
            disabled={isLoading}
            className={cn(
              "flex items-center justify-center gap-2 py-2.5 rounded-xl",
              "text-sm font-medium transition-all active:scale-[0.98]",
              isLoading
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-green-600 hover:bg-green-500 text-white",
            )}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            Konfirmasi
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PembayaranPage() {
  const { role }    = useAuth();
  const router      = useRouter();
  const queryClient = useQueryClient();

  const [rejectTarget, setRejectTarget] = useState<PendingPaymentItem | null>(null);

  // Guard
  useEffect(() => {
    if (role && role !== "superadmin") router.replace("/dashboard");
  }, [role, router]);

  const {
    data:      payments = [],
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey:        ["pending-payments"],
    queryFn:         superadminApi.listPendingPayments,
    refetchInterval: 30_000,   // auto-refresh every 30s
    staleTime:       15_000,
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, payload }: {
      id:      string;
      payload: ReviewPaymentPayload;
    }) => superadminApi.reviewPayment(id, payload),

    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["pending-payments"] });
      setRejectTarget(null);

      if (variables.payload.action === "confirm") {
        const until = data.period_end
          ? new Date(data.period_end).toLocaleDateString("id-ID", {
              day: "numeric", month: "long", year: "numeric",
            })
          : "";
        toast.success(`✅ Pembayaran dikonfirmasi — aktif hingga ${until}`);
      } else {
        toast.success("Pembayaran ditolak. Notifikasi dikirim ke Ketua RT.");
      }
    },

    onError: (err: any) =>
      toast.error(err?.response?.data?.detail ?? "Gagal memproses pembayaran."),
  });

  const handleConfirm = (payment: PendingPaymentItem) =>
    reviewMutation.mutate({
      id:      payment.payment_id,
      payload: { action: "confirm" },
    });

  const handleReject = (reason: string) => {
    if (!rejectTarget) return;
    reviewMutation.mutate({
      id:      rejectTarget.payment_id,
      payload: { action: "reject", rejection_reason: reason },
    });
  };

  return (
    <div className="max-w-5xl mx-auto">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Konfirmasi Pembayaran</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Tinjau bukti transfer langganan dari Ketua RT
          </p>
        </div>
        <div className="flex items-center gap-3">
          {payments.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full
                            bg-amber-50 border border-amber-200">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-amber-700 text-sm font-medium">
                {payments.length} menunggu konfirmasi
              </span>
            </div>
          )}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200
                       text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── SLA reminder ─────────────────────────────────────────────────── */}
      {payments.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4
                        flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-blue-800">
              Target konfirmasi: 1×24 jam
            </p>
            <p className="text-xs text-blue-600 mt-0.5">
              Ketua RT menunggu konfirmasi agar akses penuh aktif kembali.
              Konfirmasi segera untuk pengalaman terbaik mereka.
            </p>
          </div>
        </div>
      )}

      {/* ── Loading skeleton ─────────────────────────────────────────────── */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i}
              className="bg-white rounded-2xl border border-gray-200 shadow-sm h-80 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* ── Error state ──────────────────────────────────────────────────── */}
      {isError && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
            <XCircle className="w-7 h-7 text-red-400" />
          </div>
          <h3 className="font-medium text-gray-900 mb-1">Gagal memuat data pembayaran</h3>
          <p className="text-sm text-gray-500 mb-4">Pastikan Anda login sebagai superadmin</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm
                       hover:bg-gray-700 transition-colors"
          >
            Coba lagi
          </button>
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────────────────── */}
      {!isLoading && !isError && payments.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">
            Tidak ada pembayaran yang menunggu
          </h3>
          <p className="text-sm text-gray-500">
            Semua bukti transfer sudah ditinjau. Good job! 🎉
          </p>
        </div>
      )}

      {/* ── Payment cards grid ───────────────────────────────────────────── */}
      {!isLoading && !isError && payments.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {payments.map((payment) => (
            <PaymentCard
              key={payment.payment_id}
              payment={payment}
              onConfirm={handleConfirm}
              onReject={setRejectTarget}
              isLoading={
                reviewMutation.isPending &&
                reviewMutation.variables?.id === payment.payment_id
              }
            />
          ))}
        </div>
      )}

      {/* ── Reject modal ─────────────────────────────────────────────────── */}
      {rejectTarget && (
        <RejectModal
          payment={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onReject={handleReject}
          isPending={reviewMutation.isPending}
        />
      )}
    </div>
  );
}
