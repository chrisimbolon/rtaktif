"use client";

/**
 * app/(admin)/superadmin/verifikasi/page.tsx
 *
 * Superadmin review dashboard — Ketua RT verification queue.
 *
 * Shows all pending RT groups with:
 *   - RT identity (RT/RW, Kelurahan, Kecamatan, Kota)
 *   - Ketua RT name + phone
 *   - KTP + SK document links
 *   - Submitted date
 *   - Approve button (green)
 *   - Reject button (red) → opens reason modal
 *
 * Only accessible to users with role=superadmin.
 * Non-superadmins are redirected by AdminLayout.
 */

import { superadminApi, type PendingRTGroup } from "@/lib/api/superadmin";
import { useAuth } from "@/lib/hooks/useAuth";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    AlertTriangle,
    CheckCircle,
    Clock,
    ExternalLink,
    FileText, Phone,
    RefreshCw, Shield,
    User,
    XCircle
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

// ─── Reject Modal ─────────────────────────────────────────────────────────────

interface RejectModalProps {
  group:    PendingRTGroup;
  onClose:  () => void;
  onReject: (reason: string) => void;
  isPending: boolean;
}

function RejectModal({ group, onClose, onReject, isPending }: RejectModalProps) {
  const [reason, setReason] = useState("");
  const MIN_CHARS = 10;
  const valid = reason.trim().length >= MIN_CHARS;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <XCircle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 className="text-white font-semibold">Tolak Verifikasi</h3>
            <p className="text-gray-400 text-xs mt-0.5">{group.rt_identity}</p>
          </div>
        </div>

        {/* Warning */}
        <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-4">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-amber-300 text-xs">
            Ketua RT akan menerima notifikasi penolakan dan diminta untuk
            mengunggah ulang dokumen yang valid.
          </p>
        </div>

        {/* Reason input */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Alasan Penolakan
            <span className="text-red-400 ml-1">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Contoh: Foto KTP tidak jelas, mohon unggah ulang dengan pencahayaan yang baik..."
            rows={4}
            className={cn(
              "w-full px-4 py-3 rounded-xl bg-gray-800 border text-white text-sm",
              "placeholder:text-gray-600 resize-none focus:outline-none focus:ring-2 transition-all",
              valid
                ? "border-gray-600 focus:border-red-500 focus:ring-red-500/20"
                : "border-gray-700 focus:border-red-500 focus:ring-red-500/20"
            )}
          />
          <p className={cn(
            "text-xs mt-1.5 text-right",
            valid ? "text-gray-500" : "text-red-400"
          )}>
            {reason.trim().length} / {MIN_CHARS} karakter minimum
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
            disabled={isPending}
            className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-300 text-sm
                       hover:bg-gray-800 transition-colors disabled:opacity-50"
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
                : "bg-gray-800 text-gray-600 cursor-not-allowed"
            )}
          >
            {isPending ? "Menolak..." : "Tolak Verifikasi"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── RT Group Card ─────────────────────────────────────────────────────────────

interface RTGroupCardProps {
  group:     PendingRTGroup;
  onApprove: (id: string) => void;
  onReject:  (group: PendingRTGroup) => void;
  isLoading: boolean;
}

function RTGroupCard({ group, onApprove, onReject, isLoading }: RTGroupCardProps) {
  const submittedDate = new Date(group.created_at).toLocaleDateString("id-ID", {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden
                    hover:shadow-md transition-shadow">

      {/* Card header — RT identity */}
      <div className="bg-gray-900 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">RT</span>
            </div>
            <div>
              <p className="text-white font-semibold text-sm">{group.rt_identity}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Clock className="w-3 h-3 text-gray-400" />
                <span className="text-gray-400 text-xs">{submittedDate}</span>
              </div>
            </div>
          </div>
          <span className="flex-shrink-0 px-2.5 py-1 rounded-full bg-amber-500/10
                           border border-amber-500/20 text-amber-400 text-xs font-medium">
            Menunggu
          </span>
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
              <p className="text-xs text-gray-400">Nama Ketua RT</p>
              <p className="text-sm font-medium text-gray-900 truncate">
                {group.admin_full_name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
              <Phone className="w-3.5 h-3.5 text-green-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-400">Nomor HP</p>
              <p className="text-sm font-medium text-gray-900 truncate">
                {group.admin_phone}
              </p>
            </div>
          </div>
        </div>

        {/* Document links */}
        <div className="grid grid-cols-2 gap-3">
          <a
            href={group.ktp_url ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex items-center gap-2 p-3 rounded-xl border text-sm transition-colors",
              group.ktp_url
                ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                : "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
            )}
          >
            <FileText className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium">Lihat KTP</span>
            {group.ktp_url && <ExternalLink className="w-3 h-3 ml-auto flex-shrink-0" />}
          </a>
          <a
            href={group.sk_url ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex items-center gap-2 p-3 rounded-xl border text-sm transition-colors",
              group.sk_url
                ? "border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100"
                : "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
            )}
          >
            <Shield className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium">Lihat SK</span>
            {group.sk_url && <ExternalLink className="w-3 h-3 ml-auto flex-shrink-0" />}
          </a>
        </div>

        {/* Warning if missing docs */}
        {(!group.ktp_url || !group.sk_url) && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <p className="text-xs text-amber-700">
              {!group.ktp_url && !group.sk_url
                ? "KTP dan SK belum diunggah"
                : !group.ktp_url
                ? "KTP belum diunggah"
                : "SK belum diunggah"}
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            onClick={() => onReject(group)}
            disabled={isLoading}
            className="flex items-center justify-center gap-2 py-2.5 rounded-xl
                       border border-red-200 text-red-600 text-sm font-medium
                       hover:bg-red-50 transition-colors disabled:opacity-50
                       disabled:cursor-not-allowed"
          >
            <XCircle className="w-4 h-4" />
            Tolak
          </button>
          <button
            onClick={() => onApprove(group.id)}
            disabled={isLoading}
            className="flex items-center justify-center gap-2 py-2.5 rounded-xl
                       bg-green-600 hover:bg-green-500 text-white text-sm font-medium
                       transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                       active:scale-[0.98]"
          >
            <CheckCircle className="w-4 h-4" />
            Setujui
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function VerifikasiPage() {
  const { role }      = useAuth();
  const router        = useRouter();
  const queryClient   = useQueryClient();
  const [rejectTarget, setRejectTarget] = useState<PendingRTGroup | null>(null);

  // Guard — only superadmin
  useEffect(() => {
    if (role && role !== "superadmin") {
      router.replace("/dashboard");
    }
  }, [role, router]);

  // ── Query: pending list ──────────────────────────────────────────
  const {
    data: pending = [],
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["pending-rt-groups"],
    queryFn:  superadminApi.listPending,
    refetchInterval: 30_000,   // auto-refresh every 30s
  });

  // ── Mutation: approve / reject ───────────────────────────────────
  const verifyMutation = useMutation({
    mutationFn: ({ id, payload }: {
      id: string;
      payload: { action: "approve" | "reject"; rejection_reason?: string };
    }) => superadminApi.verifyRTGroup(id, payload),

    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["pending-rt-groups"] });
      setRejectTarget(null);

      if (data.verification_status === "active") {
        toast.success(`✅ ${data.rt_identity} berhasil diaktifkan!`);
      } else {
        toast.success(`Verifikasi ditolak. Notifikasi dikirim ke Ketua RT.`);
      }
    },

    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? "Gagal memproses verifikasi.");
    },
  });

  const handleApprove = (id: string) =>
    verifyMutation.mutate({ id, payload: { action: "approve" } });

  const handleReject = (reason: string) => {
    if (!rejectTarget) return;
    verifyMutation.mutate({
      id:      rejectTarget.id,
      payload: { action: "reject", rejection_reason: reason },
    });
  };

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto">

      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Verifikasi Ketua RT
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Tinjau dan setujui pendaftaran Ketua RT baru
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Live count badge */}
          {pending.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full
                            bg-amber-50 border border-amber-200">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-amber-700 text-sm font-medium">
                {pending.length} menunggu review
              </span>
            </div>
          )}

          {/* Refresh button */}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200
                       text-sm text-gray-600 hover:bg-gray-50 transition-colors
                       disabled:opacity-50"
          >
            <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-200
                                    shadow-sm h-64 animate-pulse" />
          ))}
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center
                          justify-center mb-4">
            <XCircle className="w-7 h-7 text-red-400" />
          </div>
          <h3 className="font-medium text-gray-900 mb-1">Gagal memuat data</h3>
          <p className="text-sm text-gray-500 mb-4">
            Pastikan Anda login sebagai superadmin
          </p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm
                       hover:bg-gray-700 transition-colors"
          >
            Coba lagi
          </button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && pending.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center
                          justify-center mb-4">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">Semua sudah diverifikasi!</h3>
          <p className="text-sm text-gray-500">
            Tidak ada pendaftaran Ketua RT yang menunggu review saat ini.
          </p>
        </div>
      )}

      {/* Pending cards grid */}
      {!isLoading && pending.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pending.map((group) => (
            <RTGroupCard
              key={group.id}
              group={group}
              onApprove={handleApprove}
              onReject={setRejectTarget}
              isLoading={verifyMutation.isPending}
            />
          ))}
        </div>
      )}

      {/* Reject modal */}
      {rejectTarget && (
        <RejectModal
          group={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onReject={handleReject}
          isPending={verifyMutation.isPending}
        />
      )}
    </div>
  );
}
