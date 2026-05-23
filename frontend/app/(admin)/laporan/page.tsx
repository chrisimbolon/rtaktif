// app/(admin)/laporan/page.tsx
"use client";
import { useState }                              from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm }                               from "react-hook-form";
import { zodResolver }                           from "@hookform/resolvers/zod";
import { z }                                     from "zod";
import { useRTStore }                            from "@/store/rt.store";
import { komunikasiApi }                         from "@/lib/api/komunikasi";
import { StatCard }                              from "@/components/ui/stat-card";
import { StatusBadge }                           from "@/components/ui/badge";
import { Avatar }                                from "@/components/ui/avatar";
import { formatDateTime, getStatusVariant, cn }  from "@/lib/utils";
import { toast }                                 from "sonner";
import {
  ClipboardList, CheckCircle2, Clock,
  AlertCircle, X, Loader2, ChevronDown,
  ChevronUp, ImageIcon,
} from "lucide-react";
import type { Laporan } from "@/types";

const resolveSchema = z.object({
  notes: z.string().min(5, "Keterangan minimal 5 karakter"),
});
type ResolveForm = z.infer<typeof resolveSchema>;

const STATUS_TABS = [
  { value: "all",         label: "Semua"    },
  { value: "open",        label: "Terbuka"  },
  { value: "in_progress", label: "Diproses" },
  { value: "resolved",    label: "Selesai"  },
] as const;

// ── Resolve Modal ──────────────────────────────────────────────────
function ResolveModal({ laporan, onClose }: { laporan: Laporan; onClose: () => void }) {
  const qc = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm<ResolveForm>({
    resolver: zodResolver(resolveSchema),
  });

  const mutation = useMutation({
    mutationFn: (data: ResolveForm) => komunikasiApi.laporan.resolve(laporan.id, data.notes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["laporan"] });
      toast.success("Laporan berhasil diselesaikan ✅");
      onClose();
    },
    onError: () => toast.error("Gagal menyelesaikan laporan"),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-md">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-900">Selesaikan Laporan</h3>
            <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{laporan.title}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))}>
          <div className="p-6 space-y-4">
            {/* Original report */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <p className="text-xs font-semibold text-gray-500 mb-1.5">Laporan Warga:</p>
              <p className="text-sm text-gray-700 leading-relaxed">{laporan.description}</p>
              {laporan.photo_url && (
                <a href={laporan.photo_url} target="_blank" rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs text-green-600 hover:underline">
                  <ImageIcon className="w-3 h-3" /> Lihat Foto
                </a>
              )}
            </div>

            {/* Resolution notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Keterangan Penyelesaian
              </label>
              <textarea {...register("notes")}
                placeholder="Jelaskan tindakan yang sudah dilakukan..."
                rows={4}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500/30" />
              {errors.notes && <p className="text-red-500 text-xs mt-1">{errors.notes.message}</p>}
            </div>
          </div>

          <div className="px-6 pb-6 flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              Batal
            </button>
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-700 text-white text-sm font-medium hover:bg-green-600 transition-colors disabled:opacity-60">
              {mutation.isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <CheckCircle2 className="w-4 h-4" />}
              Tandai Selesai
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Laporan Card ───────────────────────────────────────────────────
function LaporanCard({ laporan, onResolve }: {
  laporan:   Laporan;
  onResolve: () => void;
}) {
  const [expanded, setExpanded]  = useState(false);
  const qc = useQueryClient();

  const progressMutation = useMutation({
    mutationFn: () => komunikasiApi.laporan.resolve(
      laporan.id,
      "Sedang ditangani oleh pengurus RT"
    ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["laporan"] });
      toast.success("Laporan sedang diproses");
    },
  });

  const borderColor = {
    open:        "border-l-red-500",
    in_progress: "border-l-blue-500",
    resolved:    "border-l-green-500",
  }[laporan.status] ?? "border-l-gray-300";

  return (
    <div className={cn(
      "bg-white rounded-xl border border-gray-200 shadow-sm border-l-4 overflow-hidden",
      borderColor
    )}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <Avatar name={laporan.resident_id.slice(0, 6)} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-sm text-gray-900 leading-snug">{laporan.title}</h3>
                <StatusBadge status={laporan.status} variant={getStatusVariant(laporan.status)} />
              </div>
              <p className="text-[10px] text-gray-400 mt-0.5">{formatDateTime(laporan.created_at)}</p>
            </div>
          </div>
          <button onClick={() => setExpanded(!expanded)}
            className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Collapsed preview */}
        {!expanded && (
          <p className="text-xs text-gray-500 mt-2 line-clamp-2 ml-10">{laporan.description}</p>
        )}

        {/* Expanded detail */}
        {expanded && (
          <div className="mt-3 ml-10 space-y-3">
            <p className="text-sm text-gray-700 leading-relaxed">{laporan.description}</p>

            {laporan.photo_url && (
              <a href={laporan.photo_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-green-600 border border-green-200 px-3 py-1.5 rounded-lg hover:bg-green-50 transition-colors">
                <ImageIcon className="w-3.5 h-3.5" /> Lihat Foto Laporan
              </a>
            )}

            {laporan.resolution_notes && laporan.status === "resolved" && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                <p className="text-xs font-semibold text-green-700 mb-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Tindakan Pengurus:
                </p>
                <p className="text-xs text-green-700 leading-relaxed">{laporan.resolution_notes}</p>
              </div>
            )}

            {laporan.status !== "resolved" && (
              <div className="flex gap-2 pt-1">
                {laporan.status === "open" && (
                  <button
                    onClick={() => progressMutation.mutate()}
                    disabled={progressMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-xs text-blue-700 hover:bg-blue-100 transition-colors">
                    <Clock className="w-3.5 h-3.5" /> Tandai Diproses
                  </button>
                )}
                <button onClick={onResolve}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-700 text-white text-xs font-medium hover:bg-green-600 transition-colors">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Selesaikan
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────
export default function LaporanPage() {
  const { activeRT }     = useRTStore();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [resolveTarget, setResolveTarget] = useState<Laporan | null>(null);

  const { data: laporan = [], isLoading } = useQuery({
    queryKey: ["laporan", activeRT?.id, statusFilter],
    queryFn:  () => komunikasiApi.laporan.list(
      activeRT!.id,
      statusFilter === "all" ? undefined : statusFilter
    ),
    enabled: !!activeRT?.id,
  });

  const open       = laporan.filter((l) => l.status === "open").length;
  const inProgress = laporan.filter((l) => l.status === "in_progress").length;
  const resolved   = laporan.filter((l) => l.status === "resolved").length;

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Terbuka"  value={open}       sub="perlu ditangani"  icon={AlertCircle}  variant="red"   />
        <StatCard label="Diproses" value={inProgress} sub="sedang ditangani" icon={Clock}        variant="blue"  />
        <StatCard label="Selesai"  value={resolved}   sub="bulan ini"        icon={CheckCircle2} variant="green" />
      </div>

      {/* Filter tabs */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {STATUS_TABS.map((tab) => {
            const count = tab.value === "open" ? open
              : tab.value === "in_progress" ? inProgress
              : tab.value === "resolved"    ? resolved
              : laporan.length;
            return (
              <button key={tab.value} onClick={() => setStatusFilter(tab.value)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                  statusFilter === tab.value
                    ? "bg-white text-green-700 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                )}>
                {tab.label}
                <span className="ml-1.5 text-[10px] text-gray-400">({count})</span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-gray-400">{laporan.length} laporan</p>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="py-16 text-center">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400 mx-auto" />
        </div>
      ) : laporan.length === 0 ? (
        <div className="py-20 text-center">
          <ClipboardList className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400 font-medium">
            {statusFilter === "all" ? "Belum ada laporan masuk" : `Tidak ada laporan "${STATUS_TABS.find((t) => t.value === statusFilter)?.label}"`}
          </p>
          <p className="text-xs text-gray-400 mt-1">Laporan dari warga akan muncul di sini</p>
        </div>
      ) : (
        <div className="space-y-3">
          {laporan.map((l) => (
            <LaporanCard
              key={l.id}
              laporan={l}
              onResolve={() => setResolveTarget(l)}
            />
          ))}
        </div>
      )}

      {/* Resolve modal */}
      {resolveTarget && (
        <ResolveModal
          laporan={resolveTarget}
          onClose={() => setResolveTarget(null)}
        />
      )}
    </div>
  );
}
