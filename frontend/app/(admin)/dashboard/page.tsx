// app/(admin)/dashboard/page.tsx
"use client";
import { useWargaList } from "@/lib/hooks/useWarga";
import { formatRupiah } from "@/lib/utils";
import { useRTStore } from "@/store/rt.store";
import {
  AlertCircle, ChevronRight,
  Loader2,
  Send,
  TrendingUp, Users, Wallet,
} from "lucide-react";
import { useSession } from "next-auth/react";
import {
  Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

// ── Mock chart data (will be replaced with real data later) ──────────────────
const MONTHS = ["Jan","Feb","Mar","Apr","Mei","Jun"];
const mockChart = MONTHS.map((m) => ({
  month: m,
  lunas: 28 + Math.floor(Math.random() * 10),
  belum: 3  + Math.floor(Math.random() * 5),
}));

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    active:    "bg-green-100 text-green-800",
    pending:   "bg-amber-100 text-amber-800",
    suspended: "bg-red-100   text-red-700",
  };
  const labels: Record<string, string> = {
    active: "Aktif", pending: "Pending", suspended: "Suspend",
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
  const initials = name.split(" ").slice(0,2).map(n=>n[0]).join("").toUpperCase();
  const colors   = ["bg-blue-500","bg-green-500","bg-purple-500","bg-orange-500","bg-pink-500"];
  const color    = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center
      text-white text-xs font-bold flex-shrink-0`}>
      {initials}
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({
  label, value, sub, icon: Icon, variant, isCurrency,
}: {
  label:      string;
  value:      number;
  sub:        string;
  icon:       any;
  variant:    "green" | "red" | "amber" | "blue";
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

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { data: session }              = useSession();
  const { activeRT }                   = useRTStore();
  const { data: warga = [], isLoading } = useWargaList();

  const user        = session?.user as any;
  const fullName    = user?.full_name ?? user?.name ?? "Admin";

  // Derive stats from warga list (no separate invoice endpoint needed yet)
  const totalWarga  = warga.length;
  const aktifWarga  = warga.filter((w: any) => w.status === "active").length;
  const pendingWarga = warga.filter((w: any) => w.status === "pending").length;
  const kasEstimasi = aktifWarga * (activeRT?.monthly_fee_idr ?? 30_000);
  const targetTotal = totalWarga * (activeRT?.monthly_fee_idr ?? 30_000);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 11) return "Selamat pagi";
    if (h < 15) return "Selamat siang";
    if (h < 18) return "Selamat sore";
    return "Selamat malam";
  };

  return (
    <div className="space-y-6 max-w-7xl">

      {/* ── Welcome banner ───────────────────────────────────────── */}
      <div className="bg-blue-900 rounded-2xl px-6 py-5 text-white
        flex items-center justify-between">
        <div>
          <p className="text-blue-200 text-sm font-medium">{greeting()},</p>
          <h2 className="font-bold text-2xl mt-0.5">{fullName} 👋</h2>
          <p className="text-blue-300 text-sm mt-1">
            {activeRT?.display_name ?? "Konfigurasikan RT Anda di pengaturan"}
          </p>
        </div>
        <button className="hidden md:flex items-center gap-2 bg-yellow-400
          hover:bg-yellow-300 text-blue-900 px-4 py-2 rounded-lg text-sm
          font-bold transition-colors">
          <Send className="w-3.5 h-3.5" /> Kirim Reminder WA
        </button>
      </div>

      {/* ── Stats ────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total Warga"   value={totalWarga}
              sub="KK terdaftar"   icon={Users}
              variant="green"
            />
            <StatCard
              label="Warga Aktif"  value={aktifWarga}
              sub="Terverifikasi"  icon={TrendingUp}
              variant="green"
            />
            <StatCard
              label="Pending"      value={pendingWarga}
              sub="Menunggu verifikasi" icon={AlertCircle}
              variant="red"
            />
            <StatCard
              label="Est. Kas Bulan Ini" value={kasEstimasi}
              sub={`Target ${formatRupiah(targetTotal)}`}
              icon={Wallet}        variant="amber"
              isCurrency
            />
          </div>

          {/* ── Chart + Warga list ──────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Chart */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200
              shadow-sm p-5">
              <h3 className="font-bold text-gray-900 mb-1">Pembayaran 6 Bulan</h3>
              <p className="text-xs text-gray-400 mb-5">
                Lunas vs Belum Bayar
                <span className="ml-2 bg-amber-100 text-amber-700 text-[10px]
                  px-1.5 py-0.5 rounded font-medium">
                  Data simulasi — Tagihan belum diaktifkan
                </span>
              </p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={mockChart} barSize={14} barGap={4}>
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9ca3af" }}
                    axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }}
                    axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "#fff", border: "1px solid #e5e7eb",
                      borderRadius: 8, fontSize: 12 }}
                  />
                  <Bar dataKey="lunas" fill="#1d4ed8" radius={[4,4,0,0]} name="Lunas" />
                  <Bar dataKey="belum" fill="#ef4444" radius={[4,4,0,0]} name="Belum Bayar" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Pending warga */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm
              overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center
                justify-between">
                <h3 className="font-bold text-gray-900 text-sm">Pending Verifikasi</h3>
                <span className="text-xs bg-amber-50 text-amber-600 border
                  border-amber-200 px-2 py-0.5 rounded-full font-medium">
                  {pendingWarga} warga
                </span>
              </div>
              <div className="divide-y divide-gray-100 max-h-[240px] overflow-y-auto">
                {pendingWarga === 0 ? (
                  <div className="px-5 py-8 text-center text-sm text-gray-400">
                    🎉 Tidak ada yang pending!
                  </div>
                ) : warga
                    .filter((w: any) => w.status === "pending")
                    .slice(0, 6)
                    .map((w: any) => (
                      <div key={w.id} className="px-5 py-3 flex items-center
                        gap-3 hover:bg-gray-50">
                        <Avatar name={w.full_name} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-800 truncate">
                            {w.full_name}
                          </p>
                          <p className="text-[10px] text-gray-400 truncate">
                            {w.email}
                          </p>
                        </div>
                        <StatusBadge status={w.status} />
                      </div>
                    ))
                }
              </div>
              {pendingWarga > 0 && (
                <div className="px-5 py-3 border-t border-gray-100">
                  <a href="/warga"
                    className="text-xs text-blue-600 flex items-center gap-1
                      font-medium hover:text-blue-800">
                    Verifikasi di Data Warga
                    <ChevronRight className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* ── Warga terdaftar table ───────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm
            overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center
              justify-between">
              <h3 className="font-bold text-gray-900 text-sm">Warga Terdaftar</h3>
              <a href="/warga"
                className="text-xs text-blue-600 flex items-center gap-1 font-medium
                  hover:text-blue-800">
                Lihat semua <ChevronRight className="w-3 h-3" />
              </a>
            </div>
            <div className="divide-y divide-gray-100">
              {warga.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-gray-400">
                  Belum ada warga terdaftar
                </div>
              ) : warga.slice(0, 5).map((r: any) => (
                <div key={r.id} className="px-5 py-3.5 flex items-center gap-4
                  hover:bg-gray-50">
                  <Avatar name={r.full_name} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {r.full_name}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {r.email}
                      {r.phone ? ` · ${r.phone}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
