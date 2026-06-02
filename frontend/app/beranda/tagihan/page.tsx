"use client";
// app/beranda/tagihan/page.tsx
// Warga portal — view own invoices + upload bukti bayar
// Mobile-first, matches beranda design language (blue-900 header, max-w-lg)
//
// Backend endpoints used:
//   GET  /tagihan/rt/{rt_group_id}?year=&month=   ← filtered by resident_id server-side
//   POST /tagihan/{id}/upload-bukti               ← warga uploads proof
//
// Note: backend GET /tagihan/rt/{id} returns all invoices for the RT.
// We filter client-side by resident_id matching session user's resident.
// TODO: add GET /tagihan/my-invoices endpoint for proper warga-scoped query.

import {
  formatRupiah,
  getInvoicesByPeriod,
  getPeriodOptions,
  uploadBuktiBayar,
  type Invoice,
} from "@/lib/api/tagihan";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, CheckCircle, Clock, AlertCircle,
  Upload, FileText, Image, Loader2, ChevronDown,
} from "lucide-react";

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  issued: {
    label: "Belum Bayar",
    cls:   "bg-amber-100 text-amber-800 border-amber-200",
    icon:  Clock,
    desc:  "Silakan lakukan pembayaran dan upload bukti",
  },
  paid: {
    label: "Lunas",
    cls:   "bg-green-100 text-green-800 border-green-200",
    icon:  CheckCircle,
    desc:  "Pembayaran telah dikonfirmasi Ketua RT",
  },
  overdue: {
    label: "Terlambat",
    cls:   "bg-red-100 text-red-700 border-red-200",
    icon:  AlertCircle,
    desc:  "Segera lakukan pembayaran",
  },
  cancelled: {
    label: "Dibatalkan",
    cls:   "bg-gray-100 text-gray-500 border-gray-200",
    icon:  AlertCircle,
    desc:  "Tagihan ini dibatalkan",
  },
} as const;

// ── Bukti upload section ──────────────────────────────────────────────────────

function BuktiUploadSection({
  invoice,
  onUploaded,
}: {
  invoice:    Invoice;
  onUploaded: () => void;
}) {
  const [file, setFile]           = useState<File | null>(null);
  const [preview, setPreview]     = useState<string | null>(null);
  const [progress, setProgress]   = useState(0);
  const fileInputRef              = useRef<HTMLInputElement>(null);

  const uploadMutation = useMutation({
    mutationFn: () => uploadBuktiBayar(invoice.id, file!, setProgress),
    onSuccess: () => {
      toast.success("✅ Bukti bayar berhasil diunggah! Menunggu konfirmasi Ketua RT.");
      onUploaded();
      setFile(null);
      setPreview(null);
      setProgress(0);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? "Gagal mengunggah bukti bayar");
      setProgress(0);
    },
  });

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    const ALLOWED  = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    const MAX_SIZE = 5 * 1024 * 1024;

    if (!ALLOWED.includes(f.type)) {
      toast.error("Format tidak didukung. Gunakan JPG, PNG, WebP, atau PDF.");
      return;
    }
    if (f.size > MAX_SIZE) {
      toast.error("Ukuran file maksimal 5 MB");
      return;
    }

    setFile(f);
    if (f.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target?.result as string);
      reader.readAsDataURL(f);
    } else {
      setPreview(null);
    }
  }, []);

  if (invoice.status === "paid") {
    return (
      <div className="flex items-center gap-2 bg-green-50 border border-green-200
        rounded-xl p-3">
        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
        <p className="text-xs text-green-700 font-medium">
          Pembayaran telah dikonfirmasi Ketua RT
        </p>
      </div>
    );
  }

  if (invoice.status === "cancelled") return null;

  const hasBukti = !!invoice.bukti_url;

  return (
    <div className="space-y-3">

      {/* Existing bukti indicator */}
      {hasBukti && !file && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200
          rounded-xl p-3">
          <Image className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-blue-700 font-medium">
              Bukti bayar sudah diunggah
            </p>
            <p className="text-[10px] text-blue-500 mt-0.5">
              Menunggu konfirmasi Ketua RT
            </p>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-[10px] text-blue-600 font-medium underline flex-shrink-0"
          >
            Ganti
          </button>
        </div>
      )}

      {/* File preview */}
      {file && (
        <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
          {preview ? (
            <img src={preview} alt="Preview bukti" className="w-full max-h-48 object-contain" />
          ) : (
            <div className="flex items-center gap-3 p-3">
              <FileText className="w-8 h-8 text-gray-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-700 truncate">{file.name}</p>
                <p className="text-[10px] text-gray-400">
                  {(file.size / 1024).toFixed(0)} KB
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Upload progress */}
      {uploadMutation.isPending && (
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Mengunggah bukti bayar...</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        {!file ? (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-2 py-2.5
              rounded-xl border border-blue-200 bg-blue-50 text-blue-700
              text-sm font-semibold hover:bg-blue-100 transition-colors"
          >
            <Upload className="w-4 h-4" />
            {hasBukti ? "Ganti Bukti Bayar" : "Upload Bukti Bayar"}
          </button>
        ) : (
          <>
            <button
              onClick={() => { setFile(null); setPreview(null); }}
              disabled={uploadMutation.isPending}
              className="px-4 py-2.5 rounded-xl border border-gray-200
                text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50
                transition-colors"
            >
              Batal
            </button>
            <button
              onClick={() => uploadMutation.mutate()}
              disabled={uploadMutation.isPending}
              className="flex-1 flex items-center justify-center gap-2 py-2.5
                rounded-xl bg-blue-700 text-white text-sm font-semibold
                hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              {uploadMutation.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Mengunggah...</>
                : <><Upload className="w-4 h-4" /> Kirim Bukti</>
              }
            </button>
          </>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}

// ── Invoice Card ──────────────────────────────────────────────────────────────

function InvoiceCard({
  invoice,
  onUploaded,
}: {
  invoice:    Invoice;
  onUploaded: () => void;
}) {
  const [expanded, setExpanded] = useState(invoice.status !== "paid");
  const cfg  = STATUS_CONFIG[invoice.status as keyof typeof STATUS_CONFIG]
               ?? STATUS_CONFIG.issued;
  const Icon = cfg.icon;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm
      overflow-hidden">

      {/* Card header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left
          hover:bg-gray-50 transition-colors"
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center
          flex-shrink-0 border ${cfg.cls}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900">
            Iuran {invoice.period}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {formatRupiah(invoice.amount_idr)}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full
            border ${cfg.cls}`}>
            {cfg.label}
          </span>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform
            ${expanded ? "rotate-180" : ""}`} />
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-4">

          {/* Invoice details */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Periode",  value: invoice.period                    },
              { label: "Nominal",  value: formatRupiah(invoice.amount_idr)  },
              { label: "Status",   value: cfg.label                         },
            ].map(item => (
              <div key={item.label}
                className="bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] text-gray-400 font-medium uppercase
                  tracking-wider mb-0.5">
                  {item.label}
                </p>
                <p className="text-sm font-semibold text-gray-900">
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          {/* Status description */}
          <p className="text-xs text-gray-500">{cfg.desc}</p>

          {/* Bukti upload section */}
          <BuktiUploadSection invoice={invoice} onUploaded={onUploaded} />

          {/* Payment instructions for unpaid */}
          {(invoice.status === "issued" || invoice.status === "overdue") && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4
              space-y-2">
              <p className="text-xs font-bold text-amber-800">
                Cara Pembayaran
              </p>
              <div className="space-y-1.5 text-xs text-amber-700">
                <p>1. Lakukan pembayaran {formatRupiah(invoice.amount_idr)} ke Ketua RT</p>
                <p>2. Minta struk atau screenshot bukti transfer</p>
                <p>3. Upload bukti di atas</p>
                <p>4. Tunggu konfirmasi dari Ketua RT</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function WargaTagihanPage() {
  const { data: session, status } = useSession();
  const router      = useRouter();
  const queryClient = useQueryClient();

  const user       = session?.user as any;
  const rtGroupId  = user?.rt_group_id as string | null;
  const residentId = user?.id as string | null;

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  const now     = new Date();
  const periods = getPeriodOptions(3);
  const [selectedPeriod, setSelectedPeriod] = useState(0);
  const { year, month } = periods[selectedPeriod];

  const {
    data: allInvoices = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["warga-invoices", rtGroupId, year, month],
    queryFn:  () => getInvoicesByPeriod(rtGroupId!, year, month),
    enabled:  !!rtGroupId,
    staleTime: 30_000,
  });

  const myInvoices = allInvoices.filter(
    inv => inv.resident_name === (user?.full_name ?? user?.name)
           || inv.resident_id === residentId
  );

  const hasUnpaid = myInvoices.some(
    i => i.status === "issued" || i.status === "overdue"
  );

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

      {/* Header */}
      <div className="bg-blue-900 text-white">
        <div className="max-w-lg mx-auto px-4 py-5">
          <div className="flex items-center gap-3 mb-1">
            <Link href="/beranda"
              className="p-1.5 rounded-lg hover:bg-blue-800 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="font-bold text-sm">Tagihan Iuran</h1>
              <p className="text-blue-300 text-xs">Status pembayaran bulanan</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* No RT group yet */}
        {!rtGroupId && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5
            text-center">
            <div className="text-3xl mb-3">⏳</div>
            <p className="font-bold text-amber-800 mb-1">Akun belum terverifikasi</p>
            <p className="text-xs text-amber-600">
              Hubungi Ketua RT untuk memverifikasi akun Anda
            </p>
          </div>
        )}

        {rtGroupId && (
          <>
            {/* Period selector */}
            <div className="bg-white rounded-2xl border border-gray-200
              shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase
                  tracking-wider mb-3">Pilih Periode</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {periods.map((p, i) => (
                    <button
                      key={p.label}
                      onClick={() => setSelectedPeriod(i)}
                      className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs
                        font-semibold border transition-all ${
                          selectedPeriod === i
                            ? "bg-blue-900 text-white border-blue-900"
                            : "bg-gray-50 text-gray-600 border-gray-200 hover:border-blue-300"
                        }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Unpaid reminder banner */}
            {hasUnpaid && (
              <div className="bg-amber-600 text-white rounded-2xl p-4
                flex items-center gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-bold">Ada tagihan belum dibayar!</p>
                  <p className="text-xs text-amber-200 mt-0.5">
                    Segera lakukan pembayaran dan upload bukti
                  </p>
                </div>
              </div>
            )}

            {/* Invoice list */}
            {isLoading ? (
              <div className="bg-white rounded-2xl border border-gray-200
                shadow-sm p-8 text-center">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600
                  mx-auto mb-2" />
                <p className="text-sm text-gray-400">Memuat tagihan...</p>
              </div>
            ) : isError ? (
              <div className="bg-white rounded-2xl border border-gray-200
                shadow-sm p-8 text-center">
                <p className="text-sm font-bold text-gray-700 mb-1">
                  Gagal memuat tagihan
                </p>
                <button onClick={() => refetch()}
                  className="text-xs text-blue-600 hover:underline">
                  Coba lagi
                </button>
              </div>
            ) : myInvoices.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200
                shadow-sm p-8 text-center">
                <div className="text-4xl mb-3">💳</div>
                <p className="text-sm font-bold text-gray-700 mb-1">
                  Belum ada tagihan
                </p>
                <p className="text-xs text-gray-400">
                  untuk periode {periods[selectedPeriod].label}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {myInvoices.map(inv => (
                  <InvoiceCard
                    key={inv.id}
                    invoice={inv}
                    onUploaded={() => {
                      queryClient.invalidateQueries({
                        queryKey: ["warga-invoices", rtGroupId]
                      });
                    }}
                  />
                ))}
              </div>
            )}

            {/* Help card */}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl
              p-5 text-center">
              <p className="text-sm font-bold text-blue-900 mb-1">
                Ada pertanyaan tentang tagihan?
              </p>
              <p className="text-xs text-blue-700 mb-3">
                Hubungi Ketua RT Anda untuk klarifikasi
              </p>
              <Link href="/beranda"
                className="inline-flex items-center gap-2 bg-blue-900 text-white
                  px-4 py-2 rounded-lg text-xs font-semibold hover:bg-blue-800
                  transition-colors">
                ← Kembali ke Beranda
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
