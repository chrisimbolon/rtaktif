"use client";
// app/(admin)/laporan-keuangan/page.tsx
// G) Laporan Keuangan — annual financial report
// Features:
//   - Year selector
//   - KPI cards: total collected, outstanding, paid invoices, collection rate
//   - Bar chart: monthly kas masuk (recharts)
//   - Monthly breakdown table
//   - Recent payment history
//
// Backend: GET /tagihan/keuangan/{rt_group_id}?year=2026

import { formatRupiah } from "@/lib/api/tagihan";
import { useRTStore }   from "@/store/rt.store";
import { useQuery }     from "@tanstack/react-query";
import {
  Bar, BarChart, CartesianGrid,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  AlertCircle, CheckCircle, ChevronDown,
  Download, Loader2, TrendingUp, Wallet,
} from "lucide-react";
import { useSession }   from "next-auth/react";
import { useMemo, useState } from "react";
import apiClient        from "@/lib/api/client";

// ── Types ─────────────────────────────────────────────────────────────────────

interface MonthlySummary {
  month:         number;
  month_label:   string;
  month_short:   string;
  kas_masuk:     number;
  payment_count: number;
  paid:          number;
  issued:        number;
  overdue:       number;
  paid_amount:   number;
  unpaid_amount: number;
}

interface PaymentHistory {
  id:            string;
  resident_name: string;
  amount_idr:    number;
  method:        string;
  paid_at:       string | null;
  bukti_url:     string | null;
  period:        string;
}

interface KeuanganReport {
  year:                    number;
  monthly_summary:         MonthlySummary[];
  total_collected:         number;
  total_outstanding:       number;
  total_paid_invoices:     number;
  total_unpaid_invoices:   number;
  payment_history:         PaymentHistory[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const METHOD_LABEL: Record<string, string> = {
  cash:          "Tunai",
  bank_transfer: "Transfer Bank",
  e_wallet:      "E-Wallet",
  qris:          "QRIS",
  other:         "Lainnya",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric", month: "short", year: "numeric",
  });
}

// ── Custom tooltip for chart ──────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-bold text-gray-900 mb-1">{label}</p>
      <p className="text-green-700">
        Kas masuk: <span className="font-bold">
          {formatRupiah(payload[0]?.value ?? 0)}
        </span>
      </p>
      {payload[0]?.payload?.payment_count > 0 && (
        <p className="text-gray-500 mt-0.5">
          {payload[0].payload.payment_count} pembayaran
        </p>
      )}
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon: Icon, color,
}: {
  label: string; value: string; sub?: string;
  icon: any; color: string;
}) {
  return (
    <div className={`rounded-2xl p-5 ${color}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold opacity-80 uppercase tracking-wider mb-1">
            {label}
          </p>
          <p className="text-2xl font-extrabold">{value}</p>
          {sub && <p className="text-xs opacity-70 mt-1">{sub}</p>}
        </div>
        <div className="p-2.5 rounded-xl bg-white/20">
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function LaporanKeuanganPage() {
  const { data: session } = useSession();
  const { activeRT }      = useRTStore();
  const rtGroupId         = (session?.user as any)?.rt_group_id as string | null;

  const now       = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const years     = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];

  const { data: report, isLoading, isError, refetch } = useQuery<KeuanganReport>({
    queryKey: ["keuangan", rtGroupId, year],
    queryFn:  async () => {
      const { data } = await apiClient.get(
        `/tagihan/keuangan/${rtGroupId}`,
        { params: { year } }
      );
      return data;
    },
    enabled:   !!rtGroupId,
    staleTime: 60_000,
  });

  const collectionRate = useMemo(() => {
    if (!report) return 0;
    const total = report.total_paid_invoices + report.total_unpaid_invoices;
    if (!total) return 0;
    return Math.round((report.total_paid_invoices / total) * 100);
  }, [report]);

  const chartData = useMemo(() => {
    if (!report) return [];
    return report.monthly_summary
      .filter(m => m.kas_masuk > 0 || m.paid > 0 || m.issued > 0)
      .map(m => ({
        name:          m.month_short,
        kas_masuk:     m.kas_masuk,
        payment_count: m.payment_count,
        paid:          m.paid,
        unpaid:        m.issued + m.overdue,
      }));
  }, [report]);

  if (!rtGroupId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-4xl mb-3">⚙️</div>
          <p className="font-bold text-gray-800">RT belum dikonfigurasi</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Page header ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Laporan Keuangan</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Rekapitulasi kas & iuran RT · {activeRT?.display_name ?? ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Year selector */}
          <div className="relative">
            <select
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="pl-4 pr-8 py-2 rounded-lg border border-gray-200 text-sm
                bg-white appearance-none font-semibold text-gray-700
                focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2
              w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* ── Loading / Error ────────────────────────────────────────────── */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      )}

      {isError && (
        <div className="text-center py-12">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <p className="font-bold text-gray-800">Gagal memuat laporan</p>
          <button onClick={() => refetch()}
            className="mt-2 text-sm text-blue-600 hover:underline">
            Coba lagi
          </button>
        </div>
      )}

      {report && (
        <>
          {/* ── KPI Cards ───────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Total Terkumpul"
              value={formatRupiah(report.total_collected)}
              sub={`Tahun ${year}`}
              icon={Wallet}
              color="bg-blue-900 text-white"
            />
            <KpiCard
              label="Belum Terbayar"
              value={formatRupiah(report.total_outstanding)}
              sub="Perlu ditagih"
              icon={AlertCircle}
              color="bg-amber-50 text-amber-900"
            />
            <KpiCard
              label="Tagihan Lunas"
              value={String(report.total_paid_invoices)}
              sub={`dari ${report.total_paid_invoices + report.total_unpaid_invoices} tagihan`}
              icon={CheckCircle}
              color="bg-green-50 text-green-900"
            />
            <KpiCard
              label="Tingkat Koleksi"
              value={`${collectionRate}%`}
              sub={collectionRate >= 80 ? "Bagus! 🎉" : "Perlu ditingkatkan"}
              icon={TrendingUp}
              color={collectionRate >= 80
                ? "bg-green-900 text-white"
                : "bg-orange-50 text-orange-900"}
            />
          </div>

          {/* ── Bar chart ───────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-200
            shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-bold text-gray-900">
                  Kas Masuk Bulanan {year}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Pembayaran iuran yang dikonfirmasi per bulan
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-blue-900" />
                  Kas masuk
                </div>
              </div>
            </div>

            {chartData.length === 0 ? (
              <div className="h-48 flex items-center justify-center">
                <p className="text-sm text-gray-400">
                  Belum ada data pembayaran untuk {year}
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData} barSize={32}
                  margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"
                    vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }}
                    axisLine={false} tickLine={false} />
                  <YAxis
                    tickFormatter={v => v >= 1_000_000
                      ? `${(v/1_000_000).toFixed(1)}jt`
                      : v >= 1_000 ? `${(v/1_000).toFixed(0)}rb` : String(v)}
                    tick={{ fontSize: 10 }} axisLine={false} tickLine={false}
                    width={48}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="kas_masuk" fill="#1e3a5f" radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* ── Monthly breakdown table ──────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-200
            shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Rekapitulasi Bulanan</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {["Bulan", "Lunas", "Belum Bayar", "Terlambat",
                      "Kas Masuk", "Outstanding"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs
                        font-semibold text-gray-500 uppercase tracking-wider
                        whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.monthly_summary.map(m => {
                    const hasActivity = m.paid > 0 || m.issued > 0 || m.overdue > 0;
                    return (
                      <tr key={m.month}
                        className={`border-b border-gray-50 ${
                          hasActivity ? "hover:bg-gray-50" : "opacity-40"
                        } transition-colors`}>
                        <td className="px-4 py-3 font-semibold text-gray-900
                          whitespace-nowrap">
                          {m.month_label}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-green-700 font-semibold">
                            {m.paid}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={m.issued > 0
                            ? "text-amber-600 font-semibold" : "text-gray-400"}>
                            {m.issued}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={m.overdue > 0
                            ? "text-red-600 font-semibold" : "text-gray-400"}>
                            {m.overdue}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-900
                          whitespace-nowrap">
                          {m.kas_masuk > 0
                            ? formatRupiah(m.kas_masuk)
                            : <span className="text-gray-300">—</span>
                          }
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {m.unpaid_amount > 0
                            ? <span className="text-amber-600">
                                {formatRupiah(m.unpaid_amount)}
                              </span>
                            : <span className="text-gray-300">—</span>
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-blue-900 text-white">
                    <td className="px-4 py-3 font-bold">Total {year}</td>
                    <td className="px-4 py-3 font-bold">
                      {report.total_paid_invoices}
                    </td>
                    <td className="px-4 py-3 font-bold">
                      {report.total_unpaid_invoices}
                    </td>
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3 font-bold whitespace-nowrap">
                      {formatRupiah(report.total_collected)}
                    </td>
                    <td className="px-4 py-3 font-bold whitespace-nowrap">
                      {formatRupiah(report.total_outstanding)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* ── Payment history ──────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-200
            shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center
              justify-between">
              <div>
                <h2 className="font-bold text-gray-900">Riwayat Pembayaran</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  20 transaksi terakhir
                </p>
              </div>
            </div>

            {report.payment_history.length === 0 ? (
              <div className="text-center py-12">
                <Wallet className="w-8 h-8 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">
                  Belum ada riwayat pembayaran untuk {year}
                </p>
              </div>
            ) : (
              <div>
                {report.payment_history.map((p, i) => (
                  <div key={p.id}
                    className="flex items-center gap-4 px-6 py-4 border-b
                      border-gray-50 hover:bg-gray-50 transition-colors
                      last:border-0">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex
                      items-center justify-center flex-shrink-0">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {p.resident_name}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {p.period} · {METHOD_LABEL[p.method] ?? p.method}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-green-700">
                        +{formatRupiah(p.amount_idr)}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatDate(p.paid_at)}
                      </p>
                    </div>
                    {p.bukti_url && (
                      <a href={p.bukti_url} target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-gray-400 hover:text-blue-600
                          rounded-lg hover:bg-blue-50 transition-colors
                          flex-shrink-0">
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
