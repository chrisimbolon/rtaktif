"use client";
// app/(admin)/tagihan/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Method B bukti bayar flow:
//   - InvoiceRow now shows bukti indicator when bukti_url present
//   - ConfirmModal replaces single "Lunas" button click:
//       → shows bukti image/PDF preview
//       → lets treasurer pick payment method
//       → uploads bukti if treasurer wants to add their own
//       → calls PATCH /tagihan/{id}/confirm-payment
// ─────────────────────────────────────────────────────────────────────────────
import { WATagihanReminderButton } from "@/components/shared/WAReminder";
import {
  confirmPayment,
  formatRupiah,
  generateBulkInvoices,
  getInvoiceDetail,
  getInvoicesByPeriod,
  getPeriodOptions,
  markOverdueByRT,
  periodLabel,
  uploadBuktiBayar,
  type Invoice,
  type PaymentMethod,
} from "@/lib/api/tagihan";
import { useRTStore } from "@/store/rt.store";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle, CheckCircle, ChevronDown,
  FileText, Image, Loader2, Plus,
  RefreshCw, Upload, Wallet, X,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

type FilterKey = "all" | "issued" | "paid" | "overdue";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all",     label: "Semua"       },
  { key: "issued",  label: "Belum Bayar" },
  { key: "paid",    label: "Lunas"       },
  { key: "overdue", label: "Terlambat"   },
];

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash",          label: "Tunai"         },
  { value: "bank_transfer", label: "Transfer Bank"  },
  { value: "e_wallet",      label: "E-Wallet"       },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; cls: string }> = {
    issued:    { label: "Belum Bayar", cls: "bg-amber-100 text-amber-800"  },
    paid:      { label: "Lunas",       cls: "bg-green-100 text-green-800"  },
    overdue:   { label: "Terlambat",   cls: "bg-red-100   text-red-700"    },
    cancelled: { label: "Dibatalkan",  cls: "bg-gray-100  text-gray-500"   },
  };
  const { label, cls } = cfg[status] ?? { label: status, cls: "bg-gray-100 text-gray-500" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full
      text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
}

function Avatar({ name }: { name: string }) {
  const s        = name || "W";
  const initials = s.split(" ").slice(0, 2).map((n: string) => n[0]).join("").toUpperCase();
  const colors   = ["bg-blue-500", "bg-green-500", "bg-purple-500", "bg-orange-500", "bg-pink-500"];
  return (
    <div className={`w-9 h-9 rounded-full ${colors[s.charCodeAt(0) % colors.length]}
      flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
      {initials}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-gray-100">
          <div className="w-9 h-9 rounded-full bg-gray-200" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-1/3" />
            <div className="h-3 bg-gray-100 rounded w-1/4" />
          </div>
          <div className="h-6 w-20 bg-gray-200 rounded-full" />
          <div className="h-8 w-20 bg-gray-100 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

// ── Bukti Preview ─────────────────────────────────────────────────────────────

function BuktiPreview({ url }: { url: string }) {
  const isPdf = url.toLowerCase().endsWith(".pdf");
  if (isPdf) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-4 py-3 bg-gray-50 border
          border-gray-200 rounded-xl text-sm text-blue-700 hover:bg-blue-50
          transition-colors"
      >
        <FileText className="w-4 h-4 flex-shrink-0" />
        <span className="font-medium">Lihat PDF bukti bayar</span>
      </a>
    );
  }
  return (
    <div className="relative rounded-xl overflow-hidden border border-gray-200
      bg-gray-50 max-h-64">
      <img
        src={url}
        alt="Bukti bayar"
        className="w-full object-contain max-h-64"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-2 right-2 flex items-center gap-1.5 px-2.5 py-1.5
          bg-black/60 text-white text-xs rounded-lg hover:bg-black/80 transition-colors"
      >
        <Image className="w-3.5 h-3.5" />
        Perbesar
      </a>
    </div>
  );
}

// ── Confirm Payment Modal ─────────────────────────────────────────────────────

interface ConfirmModalProps {
  invoice:      Invoice;
  residentName: string;
  onClose:      () => void;
  onSuccess:    () => void;
}

function ConfirmModal({ invoice, residentName, onClose, onSuccess }: ConfirmModalProps) {
  const [method, setMethod]   = useState<PaymentMethod>("cash");
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [uploadPct, setUploadPct]       = useState(0);
  const [isUploading, setIsUploading]   = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ["invoice-detail", invoice.id],
    queryFn:  () => getInvoiceDetail(invoice.id),
    staleTime: 0,
  });

  const buktiUrl = localPreview ?? detail?.bukti_url ?? invoice.bukti_url;
  const hasBukti = !!buktiUrl;

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_SIZE = 5 * 1024 * 1024;
    const ALLOWED  = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!ALLOWED.includes(file.type)) {
      toast.error("Format tidak didukung. Gunakan JPG, PNG, WebP, atau PDF.");
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error("Ukuran file maksimal 5 MB");
      return;
    }

    setLocalFile(file);
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => setLocalPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setLocalPreview(null);
    }
  }, []);

  const confirmMutation = useMutation({
    mutationFn: async () => {
      let finalBuktiUrl = detail?.bukti_url ?? invoice.bukti_url ?? undefined;

      if (localFile) {
        setIsUploading(true);
        try {
          const result = await uploadBuktiBayar(invoice.id, localFile, setUploadPct);
          finalBuktiUrl = result.bukti_url;
        } finally {
          setIsUploading(false);
        }
      }

      return confirmPayment(invoice.id, method, finalBuktiUrl);
    },
    onSuccess: () => {
      toast.success(`✅ Pembayaran ${residentName} dikonfirmasi sebagai Lunas!`);
      onSuccess();
      onClose();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? "Gagal mengkonfirmasi pembayaran");
    },
  });

  const isPending = confirmMutation.isPending || isUploading;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center
      z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md my-4">

        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-start
          justify-between gap-3">
          <div>
            <h3 className="font-bold text-gray-900">Konfirmasi Pembayaran</h3>
            <p className="text-sm text-gray-500 mt-0.5">{residentName}</p>
          </div>
          <button onClick={onClose} disabled={isPending}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600
              hover:bg-gray-100 transition-colors flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* Invoice summary */}
          <div className="bg-gray-50 rounded-xl p-4 flex items-center
            justify-between gap-4">
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase
                tracking-wider mb-0.5">Tagihan</p>
              <p className="font-bold text-gray-900">
                {formatRupiah(invoice.amount_idr)}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{invoice.period}</p>
            </div>
            <StatusBadge status={invoice.status} />
          </div>

          {/* Bukti bayar from warga */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">
              Bukti Bayar
              {hasBukti && (
                <span className="ml-2 text-xs font-normal text-green-600
                  bg-green-50 px-1.5 py-0.5 rounded-full">
                  Ada bukti
                </span>
              )}
            </p>

            {detailLoading ? (
              <div className="h-16 bg-gray-100 rounded-xl animate-pulse" />
            ) : hasBukti ? (
              <BuktiPreview url={buktiUrl!} />
            ) : (
              <div className="flex items-center gap-2 px-4 py-3 bg-amber-50
                border border-amber-200 rounded-xl">
                <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <p className="text-sm text-amber-700">
                  Warga belum mengunggah bukti bayar
                </p>
              </div>
            )}

            {/* Optional: treasurer uploads their own bukti */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isPending}
              className="mt-2 flex items-center gap-1.5 text-xs text-gray-500
                hover:text-blue-600 transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              {hasBukti ? "Ganti bukti bayar" : "Upload bukti bayar"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            {localFile && (
              <p className="text-xs text-green-600 mt-1">
                File dipilih: {localFile.name}
              </p>
            )}
            {isUploading && (
              <div className="mt-2">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Mengunggah...</span>
                  <span>{uploadPct}%</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${uploadPct}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Payment method */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">
              Metode Pembayaran
            </p>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_METHODS.map(m => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMethod(m.value as PaymentMethod)}
                  className={`px-3 py-2.5 rounded-lg text-xs font-semibold
                    border transition-all ${
                      method === m.value
                        ? "bg-blue-900 text-white border-blue-900"
                        : "bg-white text-gray-700 border-gray-200 hover:border-blue-300"
                    }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button
            onClick={onClose}
            disabled={isPending}
            className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200
              text-sm font-semibold text-gray-700 hover:bg-gray-50
              disabled:opacity-50 transition-colors"
          >
            Batal
          </button>
          <button
            onClick={() => confirmMutation.mutate()}
            disabled={isPending}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5
              rounded-lg bg-green-700 text-white text-sm font-semibold
              hover:bg-green-600 disabled:opacity-50 transition-colors"
          >
            {isPending
              ? <><Loader2 className="w-4 h-4 animate-spin" />
                  {isUploading ? `Upload ${uploadPct}%` : "Konfirmasi..."}
                </>
              : <><CheckCircle className="w-4 h-4" /> Konfirmasi Lunas</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Generate Modal ─────────────────────────────────────────────────────────────

function GenerateModal({
  rtGroupId, defaultAmount, onClose, onSuccess,
}: {
  rtGroupId: string; defaultAmount: number;
  onClose: () => void; onSuccess: () => void;
}) {
  const now      = new Date();
  const [year,   setYear]   = useState(now.getFullYear());
  const [month,  setMonth]  = useState(now.getMonth() + 1);
  const [amount, setAmount] = useState(defaultAmount);
  const periods  = getPeriodOptions(6);

  const mutation = useMutation({
    mutationFn: () => generateBulkInvoices(rtGroupId, year, month, amount),
    onSuccess: (result) => {
      if (result.invoices_created === 0) {
        toast.info(`Semua warga sudah punya tagihan untuk ${periodLabel(year, month)}`);
      } else {
        toast.success(`✅ ${result.invoices_created} tagihan dibuat untuk ${periodLabel(year, month)}`);
      }
      onSuccess();
      onClose();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? "Gagal membuat tagihan");
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="px-6 py-5 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Terbitkan Tagihan Bulanan</h3>
          <p className="text-sm text-gray-500 mt-1">
            Buat tagihan untuk semua warga aktif sekaligus
          </p>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Periode <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                value={periodLabel(year, month)}
                onChange={e => {
                  const found = periods.find(p => p.label === e.target.value);
                  if (found) { setYear(found.year); setMonth(found.month); }
                }}
                className="w-full px-4 py-2.5 pr-10 rounded-lg border border-gray-200
                  bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100
                  focus:border-blue-400 appearance-none"
              >
                {periods.map(p => (
                  <option key={p.label} value={p.label}>{p.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2
                w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Nominal Iuran (Rp) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(Number(e.target.value))}
              min={0}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200
                bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100
                focus:border-blue-400"
            />
            <p className="text-xs text-gray-500 mt-1">= {formatRupiah(amount)} per KK</p>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
            <p className="text-xs text-blue-700 leading-relaxed">
              Tagihan dibuat untuk semua warga dengan status aktif.
              Warga yang sudah punya tagihan periode ini akan dilewati.
            </p>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200
              text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
            Batal
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !amount}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5
              rounded-lg bg-blue-900 text-white text-sm font-semibold
              hover:bg-blue-800 disabled:opacity-50 transition-colors"
          >
            {mutation.isPending
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Membuat...</>
              : <><Plus className="w-4 h-4" /> Terbitkan Tagihan</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Invoice Row ────────────────────────────────────────────────────────────────

function InvoiceRow({
  invoice, residentName, onConfirmClick, onOverdue, isLoading,
}: {
  invoice:        Invoice;
  residentName:   string;
  onConfirmClick: (inv: Invoice) => void;
  onOverdue:      (id: string) => void;
  isLoading:      boolean;
}) {
  const canConfirm = invoice.status === "issued" || invoice.status === "overdue";
  const hasBukti   = !!invoice.bukti_url;

  return (
    <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-100
      hover:bg-gray-50 transition-colors group">
      <Avatar name={residentName} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">
          {residentName || "Warga"}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-xs text-gray-500">
            {invoice.period} · {formatRupiah(invoice.amount_idr)}
          </p>
          {hasBukti && canConfirm && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold
              px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border
              border-blue-100">
              <Image className="w-2.5 h-2.5" />
              Ada bukti
            </span>
          )}
        </div>
      </div>
      <StatusBadge status={invoice.status} />
      <div className="flex items-center gap-2 flex-shrink-0 min-w-[110px]
        justify-end">
        {canConfirm && (
          <button
            onClick={() => onConfirmClick(invoice)}
            disabled={isLoading}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-white
              text-xs font-semibold rounded-lg disabled:opacity-50
              transition-colors ${
                hasBukti
                  ? "bg-blue-700 hover:bg-blue-600"
                  : "bg-green-700 hover:bg-green-600"
              }`}
          >
            <CheckCircle className="w-3.5 h-3.5" />
            {hasBukti ? "Review" : "Lunas"}
          </button>
        )}
        {invoice.status === "issued" && (
          <button
            onClick={() => onOverdue(invoice.id)}
            disabled={isLoading}
            title="Tandai terlambat"
            className="p-1.5 text-gray-400 hover:text-amber-500 rounded-lg
              hover:bg-amber-50 transition-colors opacity-0 group-hover:opacity-100"
          >
            <AlertCircle className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function TagihanPage() {
  const { data: session }  = useSession();
  const queryClient        = useQueryClient();
  const { activeRT }       = useRTStore();
  const rtGroupId          = (session?.user as any)?.rt_group_id as string | null;
  const monthlyFee         = activeRT?.monthly_fee_idr ?? 30_000;

  const now               = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [filter, setFilter]      = useState<FilterKey>("all");
  const [showModal, setShowModal] = useState(false);
  const [confirmInvoice, setConfirmInvoice] = useState<Invoice | null>(null);

  const periods = getPeriodOptions(6);
  const label   = periodLabel(year, month);

  const { data: invoices = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["invoices", rtGroupId, year, month],
    queryFn:  () => getInvoicesByPeriod(rtGroupId!, year, month),
    enabled:  !!rtGroupId,
    staleTime: 30_000,
  });

  const overdueMutation = useMutation({
    mutationFn: () => markOverdueByRT(rtGroupId!),
    onSuccess: (result) => {
      toast.success(`${result.marked_overdue} tagihan ditandai terlambat`);
      queryClient.invalidateQueries({ queryKey: ["invoices", rtGroupId] });
    },
    onError: () => toast.error("Gagal menandai terlambat"),
  });

  const filtered = useMemo(() => {
    if (filter === "all") return invoices;
    return invoices.filter(inv => inv.status === filter);
  }, [invoices, filter]);

  const stats = useMemo(() => ({
    total:  invoices.length,
    paid:   invoices.filter(i => i.status === "paid").length,
    unpaid: invoices.filter(i => i.status === "issued" || i.status === "overdue").length,
    kas:    invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.amount_idr, 0),
    withBukti: invoices.filter(i =>
      (i.status === "issued" || i.status === "overdue") && !!i.bukti_url
    ).length,
  }), [invoices]);

  if (!rtGroupId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-4xl mb-3">⚙️</div>
          <p className="font-bold text-gray-800">RT belum dikonfigurasi</p>
          <p className="text-sm text-gray-500 mt-1">
            Buka <a href="/pengaturan" className="text-blue-600 underline">Pengaturan</a> terlebih dahulu.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── Stats ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Tagihan",  value: stats.total,             sub: label,              bg: "bg-blue-50  text-blue-900"  },
          { label: "Belum Bayar",    value: stats.unpaid,            sub: "Perlu diproses",    bg: "bg-amber-50 text-amber-800" },
          { label: "Lunas",          value: stats.paid,              sub: "Bulan ini",          bg: "bg-green-50 text-green-800" },
          { label: "Kas Terkumpul",  value: formatRupiah(stats.kas), sub: "Dari tagihan lunas", bg: "bg-blue-50  text-blue-900"  },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4`}>
            <div className="text-2xl font-extrabold">{s.value}</div>
            <div className="text-xs font-semibold mt-0.5">{s.label}</div>
            <div className="text-xs opacity-70 mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Bukti bayar alert banner */}
      {stats.withBukti > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-3
          flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Image className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <p className="text-sm text-blue-800">
              <span className="font-bold">{stats.withBukti} warga</span> sudah
              upload bukti bayar — menunggu konfirmasi Anda
            </p>
          </div>
          <button
            onClick={() => setFilter("issued")}
            className="text-xs font-semibold text-blue-700 hover:text-blue-900
              bg-blue-100 hover:bg-blue-200 px-3 py-1.5 rounded-lg
              transition-colors flex-shrink-0"
          >
            Review Sekarang →
          </button>
        </div>
      )}

      {/* ── Main card ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm
        overflow-hidden">

        {/* Toolbar */}
        <div className="px-6 py-4 border-b border-gray-100 flex flex-col
          sm:flex-row items-start sm:items-center gap-3">

          <div className="relative flex-shrink-0">
            <select
              value={label}
              onChange={e => {
                const p = periods.find(p => p.label === e.target.value);
                if (p) { setYear(p.year); setMonth(p.month); }
              }}
              className="pl-4 pr-8 py-2 rounded-lg border border-gray-200 text-sm
                bg-gray-50 appearance-none font-semibold text-gray-700
                focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              {periods.map(p => (
                <option key={p.label} value={p.label}>{p.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2
              w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          </div>

          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 flex-1">
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs
                  font-semibold transition-all ${
                    filter === f.key
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
              >
                {f.label}
                {f.key !== "all" && (
                  <span className="text-[10px] font-bold px-1 rounded-full
                    bg-gray-200 text-gray-600">
                    {invoices.filter(i => i.status === f.key).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex gap-2 flex-shrink-0">
            <button onClick={() => refetch()}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600
                hover:bg-gray-100 transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
            {stats.unpaid > 0 && (
              <button
                onClick={() => overdueMutation.mutate()}
                disabled={overdueMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border
                  border-amber-200 text-amber-700 text-xs font-semibold
                  hover:bg-amber-50 disabled:opacity-50 transition-colors"
              >
                <AlertCircle className="w-3.5 h-3.5" />
                Tandai Terlambat
              </button>
            )}
            <WATagihanReminderButton
              rtGroupId={rtGroupId}
              year={year}
              month={month}
              unpaidCount={stats.unpaid}
            />
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-900 text-white
                rounded-lg text-sm font-semibold hover:bg-blue-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Terbitkan Tagihan
            </button>
          </div>
        </div>

        {/* Table header */}
        <div className="hidden lg:flex items-center gap-4 px-6 py-2.5 bg-gray-50
          border-b border-gray-100 text-xs font-semibold text-gray-500
          uppercase tracking-wider">
          <div className="w-9" />
          <div className="flex-1">Warga</div>
          <div className="w-24">Status</div>
          <div className="w-28 text-right">Aksi</div>
        </div>

        {/* Content */}
        {isLoading ? (
          <Skeleton />
        ) : isError ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">😕</div>
            <p className="font-bold text-gray-800">Gagal memuat tagihan</p>
            <button onClick={() => refetch()}
              className="mt-3 text-sm text-blue-600 hover:underline">
              Coba lagi
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">{invoices.length === 0 ? "💳" : "✅"}</div>
            <p className="font-bold text-gray-800 mb-1">
              {invoices.length === 0
                ? `Belum ada tagihan untuk ${label}`
                : "Tidak ada tagihan di filter ini"}
            </p>
            {invoices.length === 0 && (
              <button onClick={() => setShowModal(true)}
                className="mt-4 flex items-center gap-2 mx-auto px-4 py-2
                  bg-blue-900 text-white rounded-lg text-sm font-semibold
                  hover:bg-blue-800">
                <Plus className="w-4 h-4" /> Terbitkan Tagihan {label}
              </button>
            )}
          </div>
        ) : (
          <div>
            {filtered.map(inv => (
              <InvoiceRow
                key={inv.id}
                invoice={inv}
                residentName={inv.resident_name || `Warga (${inv.resident_id.slice(0, 8).toUpperCase()})`}
                onConfirmClick={setConfirmInvoice}
                onOverdue={() => overdueMutation.mutate()}
                isLoading={false}
              />
            ))}
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
              <p className="text-xs text-gray-400">
                Menampilkan {filtered.length} dari {invoices.length} tagihan · {label}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Unpaid banner */}
      {stats.unpaid > 0 && filter === "all" && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3
          flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Wallet className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-800">
              <span className="font-bold">{stats.unpaid} warga</span> belum
              membayar iuran {label}
            </p>
          </div>
          <button onClick={() => setFilter("issued")}
            className="text-xs font-semibold text-amber-700 hover:text-amber-900
              bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg
              transition-colors flex-shrink-0">
            Lihat Sekarang →
          </button>
        </div>
      )}

      {/* Modals */}
      {showModal && (
        <GenerateModal
          rtGroupId={rtGroupId}
          defaultAmount={monthlyFee}
          onClose={() => setShowModal(false)}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ["invoices"] })}
        />
      )}

      {confirmInvoice && (
        <ConfirmModal
          invoice={confirmInvoice}
          residentName={
            confirmInvoice.resident_name ||
            `Warga (${confirmInvoice.resident_id.slice(0, 8).toUpperCase()})`
          }
          onClose={() => setConfirmInvoice(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["invoices", rtGroupId] });
          }}
        />
      )}
    </div>
  );
}
