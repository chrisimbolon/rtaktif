"use client";
// app/(admin)/tagihan/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Tagihan & Iuran — matches existing backend exactly:
//   POST /tagihan/generate-bulk     { rt_group_id, year, month, amount_idr }
//   GET  /tagihan/rt/{id}?year=&month=
//   GET  /tagihan/unpaid/{id}
//   PATCH /tagihan/{id}/confirm-payment  { method, bukti_url }
//   POST /tagihan/mark-overdue/{id}
// ─────────────────────────────────────────────────────────────────────────────

import {
  confirmPayment,
  formatRupiah,
  generateBulkInvoices,
  getInvoicesByPeriod,
  getPeriodOptions,
  markOverdueByRT,
  periodLabel,
  type Invoice
} from "@/lib/api/tagihan";
import { useRTStore } from "@/store/rt.store";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle,
  ChevronDown, Loader2,
  Plus,
  RefreshCw,
  Wallet
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

type FilterKey = "all" | "issued" | "paid" | "overdue";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all",     label: "Semua"       },
  { key: "issued",  label: "Belum Bayar" },
  { key: "paid",    label: "Lunas"       },
  { key: "overdue", label: "Terlambat"   },
];

// ── Sub-components ────────────────────────────────────────────────────────────

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
  const s      = name || "W";
  const initials = s.split(" ").slice(0,2).map(n=>n[0]).join("").toUpperCase();
  const colors   = ["bg-blue-500","bg-green-500","bg-purple-500","bg-orange-500","bg-pink-500"];
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
      {[1,2,3,4,5].map(i => (
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

// ── Generate Modal ─────────────────────────────────────────────────────────────

function GenerateModal({
  rtGroupId,
  defaultAmount,
  onClose,
  onSuccess,
}: {
  rtGroupId:     string;
  defaultAmount: number;
  onClose:       () => void;
  onSuccess:     () => void;
}) {
  const now      = new Date();
  const [year,  setYear]   = useState(now.getFullYear());
  const [month, setMonth]  = useState(now.getMonth() + 1);
  const [amount, setAmount] = useState(defaultAmount);
  const periods  = getPeriodOptions(6);

  const mutation = useMutation({
    mutationFn: () => generateBulkInvoices(rtGroupId, year, month, amount),
    onSuccess: (result) => {
      if (result.invoices_created === 0) {
        toast.info(`Semua warga sudah punya tagihan untuk ${periodLabel(year, month)}`);
      } else {
        toast.success(`✅ ${result.invoices_created} tagihan berhasil dibuat untuk ${periodLabel(year, month)}`);
      }
      onSuccess();
      onClose();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? "Gagal membuat tagihan");
    },
  });

  const handlePeriodChange = (label: string) => {
    const found = periods.find(p => p.label === label);
    if (found) { setYear(found.year); setMonth(found.month); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="px-6 py-5 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Generate Tagihan Bulanan</h3>
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
                onChange={e => handlePeriodChange(e.target.value)}
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
              ℹ️ Tagihan dibuat untuk semua warga dengan status <strong>aktif</strong>.
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
              : <><Plus className="w-4 h-4" /> Generate Tagihan</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Invoice Row ────────────────────────────────────────────────────────────────

function InvoiceRow({
  invoice, residentName, onConfirm, onOverdue, isLoading,
}: {
  invoice:      Invoice;
  residentName: string;
  onConfirm:    (id: string) => void;
  onOverdue:    (id: string) => void;
  isLoading:    boolean;
}) {
  return (
    <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-100
      hover:bg-gray-50 transition-colors group">
      <Avatar name={residentName} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">
          {residentName || "Warga"}
        </p>
        <p className="text-xs text-gray-500">
          {invoice.period} · {formatRupiah(invoice.amount_idr)}
        </p>
      </div>
      <StatusBadge status={invoice.status} />
      <div className="flex items-center gap-2 flex-shrink-0 min-w-[110px] justify-end">
        {(invoice.status === "issued" || invoice.status === "overdue") && (
          <button
            onClick={() => onConfirm(invoice.id)}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700 text-white
              text-xs font-semibold rounded-lg hover:bg-green-600 disabled:opacity-50
              transition-colors"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Lunas
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

  const now                  = new Date();
  const [year,  setYear]     = useState(now.getFullYear());
  const [month, setMonth]    = useState(now.getMonth() + 1);
  const [filter, setFilter]  = useState<FilterKey>("all");
  const [actionId, setActionId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const periods = getPeriodOptions(6);
  const label   = periodLabel(year, month);

  // ── Fetch invoices ──────────────────────────────────────────────────────────
  const { data: invoices = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["invoices", rtGroupId, year, month],
    queryFn:  () => getInvoicesByPeriod(rtGroupId!, year, month),
    enabled:  !!rtGroupId,
    staleTime: 30_000,
  });

  // ── Fetch warga for name lookup (resident_id → name) ────────────────────────
  // Backend invoices use residents.id, warga list uses users.id
  // We match by position/name since we don't have resident→user mapping yet
  // Simple approach: show resident_id truncated if no match found
  // const { data: wargaList = [] } = useQuery({
  //   queryKey: ["warga", rtGroupId, "all"],
  //   queryFn:  () => getWargaList(rtGroupId!, "all"),
  //   enabled:  !!rtGroupId,
  //   staleTime: 60_000,
  // });

  // Build a name map — warga full_name indexed by their user id
  // Note: invoices.resident_id = residents.id (different from users.id)
  // Until we have a residents endpoint, we show a friendly truncated ID
  const getResidentName = (residentId: string): string => {
    const short = residentId.slice(0, 8).toUpperCase();
    return `Warga (${short})`;
  };
  
  // ── Mutations ───────────────────────────────────────────────────────────────
  const confirmMutation = useMutation({
    mutationFn: (id: string) => confirmPayment(id, "cash"),
    onMutate:   (id) => setActionId(id),
    onSuccess:  () => {
      toast.success("✅ Pembayaran dikonfirmasi!");
      queryClient.invalidateQueries({ queryKey: ["invoices", rtGroupId] });
    },
    onError: () => toast.error("Gagal mengkonfirmasi pembayaran"),
    onSettled: () => setActionId(null),
  });

  const overdueMutation = useMutation({
    mutationFn: () => markOverdueByRT(rtGroupId!),
    onSuccess: (result) => {
      toast.success(`${result.marked_overdue} tagihan ditandai terlambat`);
      queryClient.invalidateQueries({ queryKey: ["invoices", rtGroupId] });
    },
    onError: () => toast.error("Gagal menandai terlambat"),
  });

  // ── Filter ──────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (filter === "all") return invoices;
    return invoices.filter(inv => inv.status === filter);
  }, [invoices, filter]);

  // ── Stats ───────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:   invoices.length,
    paid:    invoices.filter(i => i.status === "paid").length,
    unpaid:  invoices.filter(i => i.status === "issued" || i.status === "overdue").length,
    kas:     invoices.filter(i => i.status === "paid")
                     .reduce((s, i) => s + i.amount_idr, 0),
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

      {/* ── Stats ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Tagihan",  value: stats.total,             sub: label,               bg: "bg-blue-50   text-blue-900"  },
          { label: "Belum Bayar",    value: stats.unpaid,            sub: "Perlu diproses",     bg: "bg-amber-50  text-amber-800" },
          { label: "Lunas",          value: stats.paid,              sub: "Bulan ini",           bg: "bg-green-50  text-green-800" },
          { label: "Kas Terkumpul",  value: formatRupiah(stats.kas), sub: "Dari tagihan lunas",  bg: "bg-blue-50   text-blue-900"  },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4`}>
            <div className="text-2xl font-extrabold">{s.value}</div>
            <div className="text-xs font-semibold mt-0.5">{s.label}</div>
            <div className="text-xs opacity-70 mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Main card ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

        {/* Toolbar */}
        <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row
          items-start sm:items-center gap-3">

          {/* Period selector */}
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

          {/* Filter tabs */}
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
                  <span className="text-[10px] font-bold px-1 rounded-full bg-gray-200 text-gray-600">
                    {invoices.filter(i => i.status === f.key).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Actions */}
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
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-900 text-white
                rounded-lg text-sm font-semibold hover:bg-blue-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Generate Tagihan
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
          <div className="w-24 text-right">Aksi</div>
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
                <Plus className="w-4 h-4" /> Generate Tagihan {label}
              </button>
            )}
          </div>
        ) : (
          <div>
            {filtered.map(inv => (
              <InvoiceRow
                key={inv.id}
                invoice={inv}
                residentName={inv.resident_name || getResidentName(inv.resident_id)}
                onConfirm={(id) => confirmMutation.mutate(id)}
                onOverdue={(id) => {
                  // Individual overdue — use RT-wide endpoint as workaround
                  overdueMutation.mutate();
                }}
                isLoading={actionId === inv.id}
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
              <span className="font-bold">{stats.unpaid} warga</span> belum membayar iuran {label}
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

      {showModal && (
        <GenerateModal
          rtGroupId={rtGroupId}
          defaultAmount={monthlyFee}
          onClose={() => setShowModal(false)}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ["invoices"] })}
        />
      )}
    </div>
  );
}
