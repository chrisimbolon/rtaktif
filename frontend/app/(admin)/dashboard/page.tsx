// app/(admin)/dashboard/page.tsx
"use client";
import { formatRupiah, getChartData, getUnpaidInvoices } from "@/lib/api/tagihan";
import { useWargaList } from "@/lib/hooks/useWarga";
import { useRTStore } from "@/store/rt.store";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle, ChevronRight,
  Loader2,
  TrendingUp, Users, Wallet
} from "lucide-react";
import { useSession } from "next-auth/react";
import {
  Bar, BarChart,
  Legend,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    active:    "bg-green-100 text-green-800",
    pending:   "bg-amber-100 text-amber-800",
    suspended: "bg-red-100   text-red-700",
    issued:    "bg-amber-100 text-amber-800",
    overdue:   "bg-red-100   text-red-700",
  };
  const labels: Record<string, string> = {
    active: "Aktif", pending: "Pending", suspended: "Suspend",
    issued: "Belum Bayar", overdue: "Terlambat",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold
      ${cfg[status] ?? "bg-gray-100 text-gray-600"}`}>
      {labels[status] ?? status}
    </span>
  );
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ name }: { name: string }) {
  const s      = name || "W";
  const initials = s.split(" ").slice(0,2).map((n: string) => n[0]).join("").toUpperCase();
  const colors   = ["bg-blue-500","bg-green-500","bg-purple-500","bg-orange-500","bg-pink-500"];
  return (
    <div className={`w-8 h-8 rounded-full ${colors[s.charCodeAt(0) % colors.length]}
      flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
      {initials}
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({
  label, value, sub, icon: Icon, variant, isCurrency,
}: {
  label:       string;
  value:       number;
  sub:         string;
  icon:        any;
  variant:     "green" | "red" | "amber" | "blue";
  isCurrency?: boolean;
}) {
  const colors = {
    green: "text-green-700 bg-green-50",
    red:   "text-red-600   bg-red-50",
    amber: "text-amber-600 bg-amber-50",
    blue:  "text-blue-700  bg-blue-50",
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-500">{label}</span>
        <div className={`w-8 h-8 rounded-lg ${colors[variant]} flex items-center justify-center`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="text-2xl font-extrabold text-gray-900">
        {isCurrency ? formatRupiah(value) : value}
      </div>
      <div className="text-xs text-gray-400 mt-1">{sub}</div>
    </div>
  );
}

// ── Custom chart tooltip ──────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-bold text-gray-800 mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-600">{p.name}:</span>
          <span className="font-semibold text-gray-900">{p.value}</span>
        </div>
      ))}
      {payload[0]?.payload?.kas > 0 && (
        <p className="text-green-600 font-semibold mt-1 pt-1 border-t border-gray-100">
          Kas: {formatRupiah(payload[0].payload.kas)}
        </p>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { data: session }                = useSession();
  const { activeRT }                     = useRTStore();
  const { data: warga = [], isLoading: wargaLoading } = useWargaList();

  const rtGroupId  = (session?.user as any)?.rt_group_id as string | null;
  const fullName   = (session?.user as any)?.full_name ?? (session?.user as any)?.name ?? "Admin";
  const monthlyFee = activeRT?.monthly_fee_idr ?? 30_000;

  // ── Fetch real chart data — last 6 months ─────────────────────────────────
  const { data: chartData = [], isLoading: chartLoading } = useQuery({
    queryKey:  ["dashboard-chart", rtGroupId],
    queryFn:   () => getChartData(rtGroupId!, 6),
    enabled:   !!rtGroupId,
    staleTime: 5 * 60 * 1000,   // 5 minutes cache
    refetchOnWindowFocus: false,
  });

  // ── Fetch current month unpaid — for "belum bayar" panel ─────────────────
  const { data: unpaidList = [], isLoading: unpaidLoading } = useQuery({
    queryKey:  ["dashboard-unpaid", rtGroupId],
    queryFn:   () => getUnpaidInvoices(rtGroupId!),
    enabled:   !!rtGroupId,
    staleTime: 2 * 60 * 1000,
  });

  // ── Derive stats ──────────────────────────────────────────────────────────
  const totalWarga   = warga.length;
  const aktifWarga   = warga.filter((w: any) => w.status === "active").length;
  const pendingWarga = warga.filter((w: any) => w.status === "pending").length;

  // Current month stats from chart data (last item)
  const currentMonth  = chartData[chartData.length - 1];
  const kasThisMonth  = currentMonth?.kas  ?? 0;
  const targetKas     = aktifWarga * monthlyFee;

  const isLoading = wargaLoading || chartLoading;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 11) return "Selamat pagi";
    if (h < 15) return "Selamat siang";
    if (h < 18) return "Selamat sore";
    return "Selamat malam";
  };

  // ── Chart has real data if any month has invoices ─────────────────────────
  const hasRealData = chartData.some(d => d.lunas > 0 || d.belum > 0);

  return (
    <div className="space-y-6 max-w-7xl">

      {/* ── Welcome banner ─────────────────────────────────────────────────── */}
      <div className="bg-blue-900 rounded-2xl px-6 py-5 text-white
        flex items-center justify-between">
        <div>
          <p className="text-blue-200 text-sm font-medium">{greeting()},</p>
          <h2 className="font-bold text-2xl mt-0.5">{fullName} 👋</h2>
          <p className="text-blue-300 text-sm mt-1">
            {activeRT?.display_name ?? "Konfigurasikan RT Anda di pengaturan"}
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2">
          <WATagihanReminderButton
            rtGroupId={rtGroupId!}
            year={new Date().getFullYear()}
            month={new Date().getMonth() + 1}
            unpaidCount={unpaidList.length}
          />
          <WABroadcastButton
            rtGroupId={rtGroupId!}
            wargaCount={aktifWarga}
          />
        </div>

      </div>

      {/* ── Stats ──────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total Warga"  value={totalWarga}
              sub="KK terdaftar"   icon={Users}
              variant="blue"
            />
            <StatCard
              label="Warga Aktif" value={aktifWarga}
              sub="Terverifikasi"  icon={TrendingUp}
              variant="green"
            />
            <StatCard
              label="Belum Bayar" value={unpaidList.length}
              sub="Bulan ini"      icon={AlertCircle}
              variant="red"
            />
            <StatCard
              label="Kas Bulan Ini" value={kasThisMonth}
              sub={`Target ${formatRupiah(targetKas)}`}
              icon={Wallet}         variant="amber"
              isCurrency
            />
          </div>

          {/* ── Chart + Belum Bayar panel ───────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* ── Bar chart — real data ───────────────────────────────── */}
            <div className="lg:col-span-2 bg-white rounded-xl border
              border-gray-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-bold text-gray-900">Pembayaran 6 Bulan</h3>
                {!hasRealData && (
                  <span className="text-[10px] bg-amber-100 text-amber-700
                    px-2 py-0.5 rounded-full font-medium">
                    Belum ada tagihan
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mb-4">Lunas vs Belum Bayar</p>

              {chartLoading ? (
                <div className="flex items-center justify-center h-[200px]">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData} barSize={14} barGap={4}>
                    <XAxis dataKey="month"
                      tick={{ fontSize: 11, fill: "#9ca3af" }}
                      axisLine={false} tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#9ca3af" }}
                      axisLine={false} tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                      formatter={(value) =>
                        value === "lunas" ? "Lunas" : "Belum Bayar"
                      }
                    />
                    <Bar dataKey="lunas" fill="#1d4ed8"
                      radius={[4,4,0,0]} name="lunas" />
                    <Bar dataKey="belum" fill="#f97316"
                      radius={[4,4,0,0]} name="belum" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* ── Belum bayar panel ──────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-200
              shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex
                items-center justify-between">
                <h3 className="font-bold text-gray-900 text-sm">Belum Bayar</h3>
                <span className="text-xs bg-red-50 text-red-600 border
                  border-red-200 px-2 py-0.5 rounded-full font-medium">
                  {unpaidList.length} tagihan
                </span>
              </div>
              <div className="divide-y divide-gray-100 max-h-[240px]
                overflow-y-auto">
                {unpaidLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-4 h-4 animate-spin text-gray-300" />
                  </div>
                ) : unpaidList.length === 0 ? (
                  <div className="px-5 py-8 text-center text-sm text-gray-400">
                    🎉 Semua warga sudah bayar!
                  </div>
                ) : unpaidList.slice(0, 6).map((inv: any) => (
                  <div key={inv.id}
                    className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50">
                    <Avatar name={inv.resident_name || "W"} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">
                        {inv.resident_name || "Warga"}
                      </p>
                      <p className="text-[10px] text-gray-400">{inv.period}</p>
                    </div>
                    <StatusBadge status={inv.status} />
                  </div>
                ))}
              </div>
              {unpaidList.length > 0 && (
                <div className="px-5 py-3 border-t border-gray-100">
                  <a href="/tagihan"
                    className="text-xs text-blue-600 flex items-center gap-1
                      font-medium hover:text-blue-800">
                    Kelola di Tagihan
                    <ChevronRight className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* ── Warga terdaftar table ───────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200
            shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex
              items-center justify-between">
              <h3 className="font-bold text-gray-900 text-sm">
                Warga Terdaftar
              </h3>
              <a href="/warga"
                className="text-xs text-blue-600 flex items-center gap-1
                  font-medium hover:text-blue-800">
                Lihat semua <ChevronRight className="w-3 h-3" />
              </a>
            </div>
            <div className="divide-y divide-gray-100">
              {warga.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-gray-400">
                  Belum ada warga terdaftar
                </div>
              ) : warga.slice(0, 5).map((r: any) => (
                <div key={r.id}
                  className="px-5 py-3.5 flex items-center gap-4 hover:bg-gray-50">
                  <Avatar name={r.full_name} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {r.full_name}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {r.email}{r.phone ? ` · ${r.phone}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
              ))}
            </div>
          </div>

          {/* ── Pending alert ───────────────────────────────────────────── */}
          {pendingWarga > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl
              px-5 py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <p className="text-sm text-amber-800">
                  <span className="font-bold">{pendingWarga} warga</span> menunggu verifikasi
                </p>
              </div>
              <a href="/warga"
                className="text-xs font-semibold text-amber-700 hover:text-amber-900
                  bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg
                  transition-colors flex-shrink-0">
                Verifikasi Sekarang →
              </a>
            </div>
          )}
        </>
      )}
    </div>
  );
}
