// app/(admin)/dashboard/page.tsx
// Fixes: removed useAuthStore, uses useAuth() from NextAuth instead
"use client";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { useAuth } from "@/lib/hooks/useAuth";
import { useUnpaidInvoices } from "@/lib/hooks/useTagihan";
import { useWargaList } from "@/lib/hooks/useWarga";
import { formatRupiah, getStatusVariant } from "@/lib/utils";
import { useRTStore } from "@/store/rt.store";
import {
  AlertCircle,
  ChevronRight,
  Loader2,
  Send,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis, YAxis,
} from "recharts";

const MONTHS = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];

// Mock chart data — replace with real API data later
const mockChart = MONTHS.slice(0, 6).map((m) => ({
  month: m,
  lunas: 28 + Math.floor(Math.random() * 10),
  belum: 3  + Math.floor(Math.random() * 8),
}));

export default function DashboardPage() {
  // ✅ useAuth() reads from NextAuth session — not Zustand
  const { user }     = useAuth();
  const { activeRT } = useRTStore();

  const { data: unpaid = [], isLoading: invoiceLoading } = useUnpaidInvoices();
  const { data: warga  = [], isLoading: wargaLoading  } = useWargaList();

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 11) return "Selamat pagi";
    if (h < 15) return "Selamat siang";
    if (h < 18) return "Selamat sore";
    return "Selamat malam";
  };

  const totalWarga  = warga.length;
  const sudahBayar  = totalWarga - unpaid.length;
  const kasTotal    = sudahBayar * (activeRT?.monthly_fee_idr ?? 30_000);
  const targetTotal = totalWarga * (activeRT?.monthly_fee_idr ?? 30_000);
  const isLoading   = invoiceLoading || wargaLoading;

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Greeting banner */}
      <div className="bg-green-800 rounded-2xl px-6 py-5 text-white flex items-center justify-between">
        <div>
          <p className="text-green-200 text-sm font-medium">{greeting()},</p>
          <h2 className="font-bold text-2xl mt-0.5">
            {user?.full_name ?? "Admin"} 👋
          </h2>
          <p className="text-green-300 text-sm mt-1">
            {activeRT?.display_name ?? "Konfigurasikan RT Anda di pengaturan"}
          </p>
        </div>
        <button className="hidden md:flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Send className="w-3.5 h-3.5" />
          Kirim Reminder WA
        </button>
      </div>

      {/* Stats */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Warga"   value={totalWarga}    sub="KK terdaftar"                           icon={Users}       variant="green" />
            <StatCard label="Sudah Bayar"   value={sudahBayar}    sub="Bulan ini"                              icon={TrendingUp}  variant="green" />
            <StatCard label="Belum Bayar"   value={unpaid.length} sub="Perlu reminder"                         icon={AlertCircle} variant="red"   />
            <StatCard label="Kas Terkumpul" value={kasTotal}      sub={`Target ${formatRupiah(targetTotal)}`}  icon={Wallet}      variant="amber" isCurrency />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Bar chart */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="mb-5">
                <h3 className="font-bold text-gray-900">Pembayaran 6 Bulan</h3>
                <p className="text-xs text-gray-400 mt-0.5">Lunas vs Belum Bayar</p>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={mockChart} barSize={14} barGap={4}>
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: "#fff", border: "1px solid #e5e7eb",
                      borderRadius: 8, fontSize: 12,
                    }}
                  />
                  <Bar dataKey="lunas" fill="#15803d" radius={[4,4,0,0]} name="Lunas" />
                  <Bar dataKey="belum" fill="#ef4444" radius={[4,4,0,0]} name="Belum Bayar" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Unpaid list */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-bold text-gray-900 text-sm">Belum Bayar</h3>
                <span className="text-xs bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full font-medium">
                  {unpaid.length} warga
                </span>
              </div>
              <div className="divide-y divide-gray-100 max-h-[240px] overflow-y-auto">
                {unpaid.length === 0 ? (
                  <div className="px-5 py-8 text-center text-sm text-gray-400">
                    🎉 Semua warga sudah bayar!
                  </div>
                ) : unpaid.slice(0, 6).map((inv) => (
                  <div key={inv.id} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors">
                    <Avatar name={inv.resident_name ?? "W"} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">
                        {inv.resident_name ?? "Warga"}
                      </p>
                      <p className="text-[10px] text-gray-400">{inv.period_label}</p>
                    </div>
                    <StatusBadge status={inv.status} variant={getStatusVariant(inv.status)} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent warga */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-sm">Warga Terdaftar</h3>
              <button className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1 font-medium">
                Lihat semua <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="divide-y divide-gray-100">
              {warga.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-gray-400">
                  Belum ada warga terdaftar
                </div>
              ) : warga.slice(0, 5).map((r) => (
                <div key={r.id} className="px-5 py-3.5 flex items-center gap-4 hover:bg-gray-50 transition-colors">
                  <Avatar name={r.full_name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{r.full_name}</p>
                    <p className="text-xs text-gray-400">{r.block_unit} · {r.phone}</p>
                  </div>
                  <StatusBadge status={r.status} variant={getStatusVariant(r.status)} />
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
