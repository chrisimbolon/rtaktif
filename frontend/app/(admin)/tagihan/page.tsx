// app/(admin)/tagihan/page.tsx
"use client";
import { useState, useMemo }                          from "react";
import { useInvoicesByPeriod, useUnpaidInvoices,
         useGenerateBulk, useConfirmPayment }          from "@/lib/hooks/useTagihan";
import { useRTStore }                                  from "@/store/rt.store";
import { StatCard }                                    from "@/components/ui/stat-card";
import { StatusBadge }                                 from "@/components/ui/badge";
import { Avatar }                                      from "@/components/ui/avatar";
import { formatRupiah, getStatusVariant, cn }          from "@/lib/utils";
import {
  CreditCard, Zap, CheckCircle2, AlertCircle,
  Wallet, ChevronLeft, ChevronRight,
  X, Loader2, ReceiptText, Search,
} from "lucide-react";
import type { Invoice } from "@/types";

const MONTHS = ["Januari","Februari","Maret","April","Mei","Juni",
                "Juli","Agustus","September","Oktober","November","Desember"];
const METHODS = [
  { value: "bank_transfer", label: "Transfer Bank" },
  { value: "cash",          label: "Tunai"         },
  { value: "e_wallet",      label: "E-Wallet"      },
];

// ── Generate Modal ─────────────────────────────────────────────────
function GenerateModal({ onClose, monthlyFee }: { onClose: () => void; monthlyFee: number }) {
  const now = new Date();
  const [year,   setYear]   = useState(now.getFullYear());
  const [month,  setMonth]  = useState(now.getMonth() + 1);
  const [amount, setAmount] = useState(monthlyFee);
  const mutation = useGenerateBulk();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-md">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-900">Generate Tagihan Bulk</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Periode</label>
            <div className="flex gap-3">
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
                className="flex-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30">
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
              <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))}
                className="w-24 px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nominal</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 font-medium">Rp</span>
              <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30" />
            </div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm">
            <p className="font-medium text-green-800">{MONTHS[month-1]} {year} · {formatRupiah(amount)}/warga</p>
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              Batal
            </button>
            <button
              onClick={() => mutation.mutate({ year, month, amount_idr: amount }, { onSuccess: onClose })}
              disabled={mutation.isPending}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-700 text-white text-sm font-medium hover:bg-green-600 transition-colors disabled:opacity-60">
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              Generate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Confirm Payment Modal ──────────────────────────────────────────
function ConfirmPaymentModal({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const [method,   setMethod]   = useState("bank_transfer");
  const [buktiUrl, setBuktiUrl] = useState("");
  const mutation = useConfirmPayment();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-sm">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-900">Konfirmasi Pembayaran</h3>
            <p className="text-xs text-gray-400 mt-0.5">{invoice.period_label} · {formatRupiah(invoice.amount_idr)}</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Metode Pembayaran</label>
            <div className="grid grid-cols-3 gap-2">
              {METHODS.map((m) => (
                <button key={m.value} onClick={() => setMethod(m.value)}
                  className={cn(
                    "py-2.5 px-2 rounded-lg border text-xs font-medium transition-all",
                    method === m.value ? "bg-green-700 text-white border-green-700" : "border-gray-200 text-gray-600 hover:border-green-400"
                  )}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Link Bukti Bayar <span className="text-gray-400 font-normal">(opsional)</span>
            </label>
            <input type="url" value={buktiUrl} onChange={(e) => setBuktiUrl(e.target.value)}
              placeholder="https://drive.google.com/..."
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30" />
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              Batal
            </button>
            <button
              onClick={() => mutation.mutate({ id: invoice.id, method, buktiUrl: buktiUrl || undefined }, { onSuccess: onClose })}
              disabled={mutation.isPending}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-700 text-white text-sm font-medium hover:bg-green-600 transition-colors disabled:opacity-60">
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Konfirmasi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────
export default function TagihanPage() {
  const { activeRT }   = useRTStore();
  const now            = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [search,        setSearch]        = useState("");
  const [statusFilter,  setStatusFilter]  = useState("all");
  const [showGenerate,  setShowGenerate]  = useState(false);
  const [confirmInvoice, setConfirmInvoice] = useState<Invoice | null>(null);

  const { data: invoices = [], isLoading } = useInvoicesByPeriod(year, month);

  const filtered = useMemo(() => invoices.filter((inv) => {
    const matchSearch = !search || inv.period_label.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || inv.status === statusFilter;
    return matchSearch && matchStatus;
  }), [invoices, search, statusFilter]);

  const paid    = invoices.filter((i) => i.status === "paid").length;
  const overdue = invoices.filter((i) => i.status === "overdue").length;
  const issued  = invoices.filter((i) => i.status === "issued").length;
  const kasTotal = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.amount_idr, 0);

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Sudah Bayar"   value={paid}    sub={`dari ${invoices.length} tagihan`} icon={CheckCircle2} variant="green" />
        <StatCard label="Belum Bayar"   value={issued}  sub="perlu konfirmasi"                  icon={CreditCard}   variant="amber" />
        <StatCard label="Jatuh Tempo"   value={overdue} sub="segera follow up"                  icon={AlertCircle}  variant="red"   />
        <StatCard label="Kas Terkumpul" value={kasTotal} sub={`${MONTHS[month-1]} ${year}`}     icon={Wallet}       variant="green" isCurrency />
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between">
          {/* Period nav */}
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <div className="min-w-[140px] text-center">
              <p className="font-bold text-gray-900">{MONTHS[month - 1]}</p>
              <p className="text-xs text-gray-400">{year}</p>
            </div>
            <button onClick={nextMonth} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          {/* Search + filter */}
          <div className="flex gap-2 flex-1 max-w-sm">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari tagihan..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500/30" />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border border-gray-200 text-gray-700 focus:outline-none">
              <option value="all">Semua</option>
              <option value="issued">Belum Bayar</option>
              <option value="paid">Lunas</option>
              <option value="overdue">Jatuh Tempo</option>
            </select>
          </div>

          {/* Generate button */}
          <button onClick={() => setShowGenerate(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-700 text-white text-sm font-medium hover:bg-green-600 transition-colors">
            <Zap className="w-3.5 h-3.5" /> Generate Tagihan
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <ReceiptText className="w-4 h-4 text-green-600" />
          <h3 className="font-bold text-sm text-gray-900">
            {filtered.length} Tagihan · {MONTHS[month - 1]} {year}
          </h3>
        </div>

        {isLoading ? (
          <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400 mx-auto" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <ReceiptText className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">
              {invoices.length === 0 ? "Belum ada tagihan untuk periode ini" : "Tidak ada tagihan sesuai filter"}
            </p>
            {invoices.length === 0 && (
              <button onClick={() => setShowGenerate(true)}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-700 text-white text-sm font-medium hover:bg-green-600 transition-colors">
                <Zap className="w-4 h-4" /> Generate Sekarang
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {["Warga", "Periode", "Nominal", "Status", "Aksi"].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={inv.resident_name ?? "W"} size="sm" />
                        <span className="text-sm font-medium text-gray-800">
                          {inv.resident_name ?? "Warga"}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-500">{inv.period_label}</td>
                    <td className="px-5 py-3.5 text-sm font-medium text-gray-900">{formatRupiah(inv.amount_idr)}</td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={inv.status} variant={getStatusVariant(inv.status)} />
                    </td>
                    <td className="px-5 py-3.5">
                      {inv.status !== "paid" && inv.status !== "cancelled" && (
                        <button onClick={() => setConfirmInvoice(inv)}
                          className="opacity-0 group-hover:opacity-100 text-xs bg-green-700 text-white px-2.5 py-1 rounded-md hover:bg-green-600 transition-all">
                          Konfirmasi
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showGenerate  && <GenerateModal onClose={() => setShowGenerate(false)} monthlyFee={activeRT?.monthly_fee_idr ?? 30_000} />}
      {confirmInvoice && <ConfirmPaymentModal invoice={confirmInvoice} onClose={() => setConfirmInvoice(null)} />}
    </div>
  );
}
