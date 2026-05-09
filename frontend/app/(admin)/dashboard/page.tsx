"use client";
import { useRTStore } from "@/store/rt.store";
import { useAuthStore } from "@/store/auth.store";
import { StatCard } from "@/components/ui/stat-card";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { formatRupiah, formatDateTime, getStatusVariant } from "@/lib/utils";
import { useUnpaidInvoices } from "@/lib/hooks/useTagihan";
import { useWargaList } from "@/lib/hooks/useWarga";
import {
  Users, TrendingUp, AlertCircle, Wallet,
  MessageSquare, ChevronRight, Send,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, Tooltip, Cell,
} from "recharts";

const MONTHS = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];

const mockChartData = MONTHS.slice(0, 6).map((m, i) => ({
  month: m,
  lunas: 30 + Math.floor(Math.random() * 15),
  belum: 5 + Math.floor(Math.random() * 10),
}));

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { activeRT } = useRTStore();
  const { data: unpaid = [] } = useUnpaidInvoices();
  const { data: warga  = [] } = useWargaList();

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

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Greeting */}
      <div className="bg-forest-800 batik-overlay rounded-2xl px-6 py-5 text-cream-50 flex items-center justify-between">
        <div>
          <p className="text-forest-200 text-sm font-medium">{greeting()},</p>
          <h2 className="font-display font-bold text-2xl mt-0.5">{user?.full_name ?? "Admin"} 👋</h2>
          <p className="text-forest-300 text-sm mt-1">
            {activeRT?.display_name ?? "Konfigurasikan RT Anda di pengaturan"}
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2">
          <button className="flex items-center gap-2 bg-terra-500 hover:bg-terra-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Send className="w-3.5 h-3.5" />
            Kirim Reminder WA
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Warga"   value={totalWarga}  sub="KK terdaftar"        icon={Users}       variant="green" />
        <StatCard label="Sudah Bayar"   value={sudahBayar}  sub="Bulan ini"            icon={TrendingUp}  variant="green" />
        <StatCard label="Belum Bayar"   value={unpaid.length} sub="Perlu reminder"     icon={AlertCircle} variant="red"   />
        <StatCard label="Kas Terkumpul" value={kasTotal}    sub={`Target ${formatRupiah(targetTotal)}`} icon={Wallet} variant="amber" isCurrency />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar chart */}
        <div className="lg:col-span-2 bg-cream-50 rounded-xl border border-cream-300 shadow-card p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-display font-semibold text-charcoal-900">Pembayaran 6 Bulan</h3>
              <p className="text-xs text-charcoal-400 mt-0.5">Lunas vs Belum Bayar</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={mockChartData} barSize={14} barGap={4}>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6d6d6d" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#6d6d6d" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "#fdfcf8", border: "1px solid #ecdfc0", borderRadius: 8, fontSize: 12 }}
              />
              <Bar dataKey="lunas" fill="#2d8a35" radius={[4,4,0,0]} name="Lunas" />
              <Bar dataKey="belum" fill="#e05c2f" radius={[4,4,0,0]} name="Belum Bayar" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Unpaid list */}
        <div className="bg-cream-50 rounded-xl border border-cream-300 shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-cream-200 flex items-center justify-between">
            <h3 className="font-display font-semibold text-charcoal-900 text-sm">Belum Bayar</h3>
            <span className="text-xs bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full font-medium">
              {unpaid.length} warga
            </span>
          </div>
          <div className="divide-y divide-cream-200 max-h-[240px] overflow-y-auto">
            {unpaid.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-charcoal-400">
                🎉 Semua warga sudah bayar!
              </div>
            ) : unpaid.slice(0, 6).map((inv) => (
              <div key={inv.id} className="px-5 py-3 flex items-center gap-3 hover:bg-cream-100 transition-colors">
                <Avatar name={inv.resident_name ?? "W"} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-charcoal-800 truncate">
                    {inv.resident_name ?? "Warga"}
                  </p>
                  <p className="text-[10px] text-charcoal-400">{inv.period_label}</p>
                </div>
                <StatusBadge status={inv.status} variant={getStatusVariant(inv.status)} />
              </div>
            ))}
          </div>
          {unpaid.length > 0 && (
            <div className="px-5 py-3 border-t border-cream-200">
              <button className="w-full flex items-center justify-center gap-1.5 text-xs text-forest-600 hover:text-forest-700 font-medium transition-colors">
                <Send className="w-3 h-3" />
                Kirim reminder ke semua
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Recent warga */}
      <div className="bg-cream-50 rounded-xl border border-cream-300 shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-cream-200 flex items-center justify-between">
          <h3 className="font-display font-semibold text-charcoal-900 text-sm">Warga Terdaftar</h3>
          <button className="text-xs text-forest-600 hover:text-forest-700 flex items-center gap-1 font-medium">
            Lihat semua <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        <div className="divide-y divide-cream-200">
          {warga.slice(0, 5).map((r) => (
            <div key={r.id} className="px-5 py-3.5 flex items-center gap-4 hover:bg-cream-100 transition-colors">
              <Avatar name={r.full_name} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-charcoal-900 truncate">{r.full_name}</p>
                <p className="text-xs text-charcoal-400">{r.block_unit} · {r.phone}</p>
              </div>
              <StatusBadge status={r.status} variant={getStatusVariant(r.status)} />
            </div>
          ))}
          {warga.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-charcoal-400">
              Belum ada warga terdaftar
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
