"use client";
// app/beranda/laporan/page.tsx
// Warga submits laporan + tracks status — mobile-first
// ─────────────────────────────────────────────────────────────────────────────
import { useState }       from "react";
import { useSession }     from "next-auth/react";
import { useRouter }      from "next/navigation";
import { useEffect }      from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm }        from "react-hook-form";
import { zodResolver }    from "@hookform/resolvers/zod";
import { z }              from "zod";
import Link               from "next/link";
import { toast }          from "sonner";
import { komunikasiApi }  from "@/lib/api/komunikasi";
import {
  ArrowLeft, Plus, X, Loader2,
  CheckCircle2, Clock, AlertCircle,
  ClipboardList, ChevronDown, ChevronUp,
} from "lucide-react";
import type { Laporan } from "@/types";

// ── Schema ────────────────────────────────────────────────────────────────────
const schema = z.object({
  title:       z.string().min(5,  "Judul minimal 5 karakter").max(100),
  description: z.string().min(10, "Deskripsi minimal 10 karakter").max(1000),
});
type FormData = z.infer<typeof schema>;

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CFG = {
  open: {
    label:  "Terbuka",
    icon:   AlertCircle,
    color:  "bg-red-100   text-red-700",
    border: "border-l-red-500",
    desc:   "Menunggu ditangani pengurus RT",
  },
  in_progress: {
    label:  "Diproses",
    icon:   Clock,
    color:  "bg-blue-100  text-blue-700",
    border: "border-l-blue-500",
    desc:   "Sedang ditangani pengurus RT",
  },
  resolved: {
    label:  "Selesai",
    icon:   CheckCircle2,
    color:  "bg-green-100 text-green-700",
    border: "border-l-green-500",
    desc:   "Laporan telah diselesaikan",
  },
} as const;

// ── Laporan Card ──────────────────────────────────────────────────────────────
function LaporanCard({ laporan }: { laporan: Laporan }) {
  const [expanded, setExpanded] = useState(false);
  const cfg     = STATUS_CFG[laporan.status as keyof typeof STATUS_CFG]
                  ?? STATUS_CFG.open;
  const Icon    = cfg.icon;
  const dateStr = laporan.created_at
    ? new Date(laporan.created_at).toLocaleDateString("id-ID", {
        day: "numeric", month: "long", year: "numeric",
      })
    : "—";

  return (
    <div className={`bg-white rounded-2xl border border-gray-200
      shadow-sm border-l-4 ${cfg.border} overflow-hidden`}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`inline-flex items-center gap-1 text-[10px]
                font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>
                <Icon className="w-3 h-3" />
                {cfg.label}
              </span>
              <span className="text-[10px] text-gray-400">{dateStr}</span>
            </div>
            <h3 className="text-sm font-bold text-gray-900 leading-snug">
              {laporan.title}
            </h3>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-gray-400 hover:text-gray-600 flex-shrink-0 p-1"
          >
            {expanded
              ? <ChevronUp  className="w-4 h-4" />
              : <ChevronDown className="w-4 h-4" />
            }
          </button>
        </div>

        {/* Preview */}
        {!expanded && (
          <p className="text-xs text-gray-500 mt-2 line-clamp-2 leading-relaxed">
            {laporan.description}
          </p>
        )}

        {/* Expanded */}
        {expanded && (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-gray-700 leading-relaxed">
              {laporan.description}
            </p>

            {/* Status description */}
            <div className={`rounded-xl p-3 border ${cfg.color}
              bg-opacity-50 flex items-center gap-2`}>
              <Icon className="w-4 h-4 flex-shrink-0" />
              <p className="text-xs font-medium">{cfg.desc}</p>
            </div>

            {/* Resolution notes */}
            {laporan.status === "resolved" && laporan.resolution_notes && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                <p className="text-xs font-bold text-green-700 mb-1.5 flex
                  items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Tindakan Pengurus RT:
                </p>
                <p className="text-xs text-green-800 leading-relaxed">
                  {laporan.resolution_notes}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Submit Form ───────────────────────────────────────────────────────────────
function SubmitForm({
  rtGroupId,
  onSuccess,
  onCancel,
}: {
  rtGroupId: string;
  onSuccess: () => void;
  onCancel:  () => void;
}) {
  const qc = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const descLength = watch("description")?.length ?? 0;

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      komunikasiApi.laporan.submit({
        rt_group_id: rtGroupId,
        title:       data.title,
        description: data.description,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-laporan"] });
      toast.success("✅ Laporan berhasil dikirim!");
      reset();
      onSuccess();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? "Gagal mengirim laporan");
    },
  });

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm
      overflow-hidden">
      {/* Header */}
      <div className="bg-blue-900 px-5 py-4 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-white text-sm">Buat Laporan Baru</h3>
          <p className="text-blue-300 text-xs mt-0.5">
            Laporkan masalah di lingkungan RT Anda
          </p>
        </div>
        <button
          onClick={onCancel}
          className="text-blue-300 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit(d => mutation.mutate(d))}>
        <div className="p-5 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Judul Masalah <span className="text-red-500">*</span>
            </label>
            <input
              {...register("title")}
              type="text"
              placeholder="Contoh: Lampu jalan RT mati"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200
                bg-gray-50 text-sm focus:outline-none focus:ring-2
                focus:ring-blue-100 focus:border-blue-400 transition-colors"
            />
            {errors.title && (
              <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Deskripsi Masalah <span className="text-red-500">*</span>
            </label>
            <textarea
              {...register("description")}
              rows={5}
              placeholder={
                "Jelaskan masalah secara detail.\n\n" +
                "Contoh:\nLampu jalan depan rumah No. 12 sudah mati " +
                "sejak 3 hari yang lalu. Malam hari sangat gelap " +
                "dan membahayakan warga."
              }
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200
                bg-gray-50 text-sm focus:outline-none focus:ring-2
                focus:ring-blue-100 focus:border-blue-400 transition-colors
                resize-none"
            />
            <div className="flex justify-between mt-1">
              {errors.description
                ? <p className="text-red-500 text-xs">{errors.description.message}</p>
                : <span />
              }
              <p className="text-xs text-gray-400">{descLength}/1000</p>
            </div>
          </div>

          {/* Info */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
            <p className="text-xs text-blue-700 leading-relaxed">
              ℹ️ Laporan Anda akan segera ditinjau oleh pengurus RT.
              Pantau status laporan di halaman ini.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-sm
              font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex-1 flex items-center justify-center gap-2 py-3
              rounded-xl bg-blue-900 text-white text-sm font-bold
              hover:bg-blue-800 disabled:opacity-60 transition-colors"
          >
            {mutation.isPending
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Mengirim...</>
              : <><ClipboardList className="w-4 h-4" /> Kirim Laporan</>
            }
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function BerandaLaporanPage() {
  const { data: session, status } = useSession();
  const router  = useRouter();
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  const user      = session?.user as any;
  const rtGroupId = user?.rt_group_id as string | undefined;

  // Fetch all laporan for this RT (warga sees their own — filtered client-side
  // until we add a dedicated "my laporan" endpoint)
  const { data: allLaporan = [], isLoading } = useQuery({
    queryKey:  ["my-laporan", rtGroupId],
    queryFn:   () => komunikasiApi.laporan.list(rtGroupId!),
    enabled:   !!rtGroupId,
    staleTime: 60_000,
  });

  // Stats
  const open       = allLaporan.filter(l => l.status === "open").length;
  const inProgress = allLaporan.filter(l => l.status === "in_progress").length;
  const resolved   = allLaporan.filter(l => l.status === "resolved").length;

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-900 border-t-transparent
          rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="bg-blue-900 text-white sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/beranda"
            className="p-2 rounded-lg hover:bg-white/10 transition-colors
              flex-shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <h1 className="font-bold text-sm">Laporan Masalah</h1>
            <p className="text-blue-300 text-xs">
              {allLaporan.length} laporan · {open} terbuka
            </p>
          </div>
          {!showForm && rtGroupId && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 bg-yellow-400 hover:bg-yellow-300
                text-blue-900 px-3 py-1.5 rounded-lg text-xs font-bold
                transition-colors flex-shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Buat Laporan
            </button>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">

        {/* ── Stats ───────────────────────────────────────────────── */}
        {allLaporan.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Terbuka",  value: open,       color: "bg-red-50   text-red-700"   },
              { label: "Diproses", value: inProgress,  color: "bg-blue-50  text-blue-700"  },
              { label: "Selesai",  value: resolved,    color: "bg-green-50 text-green-700" },
            ].map(s => (
              <div key={s.label} className={`${s.color} rounded-xl p-3 text-center`}>
                <div className="text-2xl font-extrabold">{s.value}</div>
                <div className="text-xs font-semibold mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Submit form ─────────────────────────────────────────── */}
        {showForm && rtGroupId && (
          <SubmitForm
            rtGroupId={rtGroupId}
            onSuccess={() => setShowForm(false)}
            onCancel={() => setShowForm(false)}
          />
        )}

        {/* ── No RT group ─────────────────────────────────────────── */}
        {!rtGroupId && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5
            text-center">
            <div className="text-4xl mb-3">⚠️</div>
            <p className="font-bold text-amber-800 mb-1">Akun Belum Terverifikasi</p>
            <p className="text-sm text-amber-700">
              Hubungi Ketua RT untuk verifikasi akun sebelum bisa melapor.
            </p>
          </div>
        )}

        {/* ── Laporan list ─────────────────────────────────────────── */}
        {rtGroupId && !showForm && (
          <>
            {isLoading ? (
              <div className="py-16 flex flex-col items-center gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                <p className="text-sm text-gray-400">Memuat laporan...</p>
              </div>
            ) : allLaporan.length === 0 ? (
              <div className="py-16 text-center">
                <ClipboardList className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="font-bold text-gray-700 mb-1">
                  Belum ada laporan
                </p>
                <p className="text-sm text-gray-400 mb-5">
                  Ada masalah di lingkungan RT? Laporkan sekarang!
                </p>
                <button
                  onClick={() => setShowForm(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-900
                    text-white rounded-xl text-sm font-bold hover:bg-blue-800
                    transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Buat Laporan Pertama
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Open first, then in_progress, then resolved */}
                {[...allLaporan]
                  .sort((a, b) => {
                    const order = { open: 0, in_progress: 1, resolved: 2 };
                    const oa = order[a.status as keyof typeof order] ?? 3;
                    const ob = order[b.status as keyof typeof order] ?? 3;
                    if (oa !== ob) return oa - ob;
                    return new Date(b.created_at ?? 0).getTime() -
                           new Date(a.created_at ?? 0).getTime();
                  })
                  .map(l => <LaporanCard key={l.id} laporan={l} />)
                }
              </div>
            )}
          </>
        )}

        {/* ── Back link ───────────────────────────────────────────── */}
        <Link href="/beranda"
          className="flex items-center justify-center gap-2 py-3 text-sm
            text-blue-600 font-semibold hover:text-blue-800 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Beranda
        </Link>

      </div>
    </div>
  );
}
