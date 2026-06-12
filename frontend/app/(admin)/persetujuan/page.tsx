"use client";
// app/(admin)/persetujuan/page.tsx
//
// Ketua RT review queue — warga self-edit change requests.
// Each pending request = one field change proposed by a warga,
// grouped by resident, FIFO order (oldest first).
//
// Wires to:
//   GET   /warga/change-requests/pending
//   PATCH /warga/change-requests/{id}/review
//
// Design matches existing (admin)/warga/page.tsx patterns:
// Avatar, StatusBadge-style chips, card layout, RejectModal pattern.

import {
  getPendingChangeRequests,
  reviewChangeRequest,
  type ChangeRequestItem,
  type ReviewChangeRequestPayload,
} from "@/lib/api/warga";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle, Clock, Loader2, RefreshCw,
  User, XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

function Avatar({ name }: { name: string }) {
  const s        = name || "W";
  const initials = s.split(" ").slice(0, 2).map((n: string) => n[0]).join("").toUpperCase();
  const colors   = ["bg-blue-500","bg-green-500","bg-purple-500","bg-orange-500","bg-pink-500","bg-teal-500"];
  return (
    <div className={`w-9 h-9 rounded-full ${colors[s.charCodeAt(0) % colors.length]}
      flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
      {initials}
    </div>
  );
}

// ── Reject Modal ───────────────────────────────────────────────────────────────

interface RejectModalProps {
  item:      ChangeRequestItem;
  onClose:   () => void;
  onReject:  (reason: string) => void;
  isPending: boolean;
}

function RejectModal({ item, onClose, onReject, isPending }: RejectModalProps) {
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
            <h3 className="text-white font-semibold">Tolak Permintaan</h3>
            <p className="text-gray-400 text-xs mt-0.5">
              {item.resident_name} — {item.field_label}
            </p>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-3 mb-4 text-xs text-gray-300">
          <span className="text-gray-500">{item.old_value || "—"}</span>
          {" → "}
          <span className="font-semibold text-white">{item.new_value || "—"}</span>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Alasan Penolakan <span className="text-red-400 ml-1">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Contoh: NIK tidak sesuai dengan KTP yang terdaftar..."
            rows={4}
            className={cn(
              "w-full px-4 py-3 rounded-xl bg-gray-800 border text-white text-sm",
              "placeholder:text-gray-600 resize-none focus:outline-none focus:ring-2",
              valid
                ? "border-gray-600 focus:border-red-500 focus:ring-red-500/20"
                : "border-gray-700 focus:border-red-500 focus:ring-red-500/20",
            )}
          />
          <p className={cn("text-xs mt-1.5 text-right", valid ? "text-gray-500" : "text-red-400")}>
            {reason.trim().length} / {MIN_CHARS} karakter minimum
          </p>
        </div>

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
                : "bg-gray-800 text-gray-600 cursor-not-allowed",
            )}
          >
            {isPending ? "Menolak..." : "Tolak Permintaan"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Request Card ─────────────────────────────────────────────────────────────

interface RequestCardProps {
  item:      ChangeRequestItem;
  onApprove: (item: ChangeRequestItem) => void;
  onReject:  (item: ChangeRequestItem) => void;
  isLoading: boolean;
}

function RequestCard({ item, onApprove, onReject, isLoading }: RequestCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5
                    hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3 mb-4">
        <Avatar name={item.resident_name} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {item.resident_name}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Clock className="w-3 h-3 text-gray-400" />
            <span className="text-xs text-gray-400">{formatDateTime(item.created_at)}</span>
          </div>
        </div>
        <span className="flex-shrink-0 px-2.5 py-1 rounded-full bg-amber-50
                         border border-amber-200 text-amber-700 text-xs font-medium">
          Menunggu
        </span>
      </div>

      {/* Field change */}
      <div className="bg-gray-50 rounded-xl p-3 mb-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          {item.field_label}
        </p>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-400 line-through truncate">
            {item.old_value || "—"}
          </span>
          <span className="text-gray-300">→</span>
          <span className="font-semibold text-gray-900 truncate">
            {item.new_value || "—"}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onReject(item)}
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
          onClick={() => onApprove(item)}
          disabled={isLoading}
          className={cn(
            "flex items-center justify-center gap-2 py-2.5 rounded-xl",
            "text-sm font-medium transition-all active:scale-[0.98]",
            isLoading
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-green-600 hover:bg-green-500 text-white",
          )}
        >
          {isLoading
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <CheckCircle className="w-4 h-4" />}
          Setujui
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PersetujuanPage() {
  const queryClient = useQueryClient();
  const [rejectTarget, setRejectTarget] = useState<ChangeRequestItem | null>(null);

  const {
    data: requests = [],
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["pending-change-requests"],
    queryFn:  getPendingChangeRequests,
    refetchInterval: 30_000,
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ReviewChangeRequestPayload }) =>
      reviewChangeRequest(id, payload),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["pending-change-requests"] });
      setRejectTarget(null);
      if (variables.payload.action === "approve") {
        toast.success(`✅ ${data.message}`);
      } else {
        toast.success("Permintaan ditolak. Warga akan melihat status di Profil Saya.");
      }
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.detail ?? "Gagal memproses permintaan."),
  });

  const handleApprove = (item: ChangeRequestItem) =>
    reviewMutation.mutate({ id: item.id, payload: { action: "approve" } });

  const handleReject = (reason: string) => {
    if (!rejectTarget) return;
    reviewMutation.mutate({
      id: rejectTarget.id,
      payload: { action: "reject", rejection_reason: reason },
    });
  };

  return (
    <div className="max-w-5xl mx-auto">

      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Persetujuan Data Warga</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Tinjau permintaan perubahan data dari warga
          </p>
        </div>
        <div className="flex items-center gap-3">
          {requests.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full
                            bg-amber-50 border border-amber-200">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-amber-700 text-sm font-medium">
                {requests.length} menunggu persetujuan
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

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-200 shadow-sm h-56 animate-pulse" />
          ))}
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
            <XCircle className="w-7 h-7 text-red-400" />
          </div>
          <h3 className="font-medium text-gray-900 mb-1">Gagal memuat data</h3>
          <p className="text-sm text-gray-500 mb-4">Coba muat ulang halaman</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm hover:bg-gray-700 transition-colors"
          >
            Coba lagi
          </button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && requests.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">Semua sudah ditinjau!</h3>
          <p className="text-sm text-gray-500">
            Tidak ada permintaan perubahan data yang menunggu saat ini.
          </p>
        </div>
      )}

      {/* Cards grid */}
      {!isLoading && requests.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {requests.map((item) => (
            <RequestCard
              key={item.id}
              item={item}
              onApprove={handleApprove}
              onReject={setRejectTarget}
              isLoading={
                reviewMutation.isPending &&
                reviewMutation.variables?.id === item.id
              }
            />
          ))}
        </div>
      )}

      {/* Reject modal */}
      {rejectTarget && (
        <RejectModal
          item={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onReject={handleReject}
          isPending={reviewMutation.isPending}
        />
      )}
    </div>
  );
}
