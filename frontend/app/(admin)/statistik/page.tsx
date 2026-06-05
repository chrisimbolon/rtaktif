"use client";
// app/(admin)/statistik/page.tsx
// Statistik Demografis — visual census data for Ketua RT
// Inspired by Mas Joko's E-Warga RW6 app
//
// Charts:
//   - KPI cards: total warga, KK, kepala keluarga
//   - Pie: jenis kelamin
//   - Pie: agama
//   - Bar: pendidikan terakhir (Kelurahan report data!)
//   - Bar: usia groups
//   - Pie: status tinggal
//   - Bar: pekerjaan

import { useRTStore }  from "@/store/rt.store";
import { useQuery }    from "@tanstack/react-query";
import {
  Bar, BarChart, CartesianGrid, Cell,
  Legend, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import {
  AlertCircle, Loader2, Users,
  Home, GraduationCap, UserCheck,
} from "lucide-react";
import { useSession }  from "next-auth/react";
import apiClient       from "@/lib/api/client";

// ── Types ─────────────────────────────────────────────────────────────────────

interface StatItem { name: string; value: number; }

interface DemografiStats {
  total_warga:     number;
  total_kk:        number;
  kepala_keluarga: number;
  jenis_kelamin:   StatItem[];
  agama:           StatItem[];
  pendidikan:      StatItem[];
  pekerjaan:       StatItem[];
  status_tinggal:  StatItem[];
  usia:            StatItem[];
  kewarganegaraan: StatItem[];
}

// ── Color palettes ────────────────────────────────────────────────────────────

const GENDER_COLORS   = ["#1e3a5f", "#ec4899"];
const AGAMA_COLORS    = ["#1e3a5f","#3b82f6","#06b6d4","#8b5cf6","#f59e0b","#10b981"];
const STATUS_COLORS   = ["#1e3a5f","#f59e0b","#8b5cf6","#ef4444","#6b7280","#10b981"];
const KWRG_COLORS     = ["#1e3a5f","#ef4444"];
const BAR_COLOR       = "#1e3a5f";
const BAR_COLOR_2     = "#3b82f6";

// ── Custom tooltip ────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg
      p-3 text-xs">
      {label && <p className="font-bold text-gray-900 mb-1">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color || p.fill }}>
          {p.name}: <span className="font-bold">{p.value} orang</span>
        </p>
      ))}
    </div>
  );
}

function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg
      p-3 text-xs">
      <p className="font-bold text-gray-900">{name}</p>
      <p className="text-gray-600 mt-0.5">{value} orang</p>
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon: Icon, color,
}: {
  label: string; value: number | string;
  sub?: string; icon: any; color: string;
}) {
  return (
    <div className={`rounded-2xl p-5 ${color}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold opacity-80 uppercase
            tracking-wider mb-1">{label}</p>
          <p className="text-3xl font-extrabold">{value}</p>
          {sub && <p className="text-xs opacity-70 mt-1">{sub}</p>}
        </div>
        <div className="p-2.5 rounded-xl bg-white/20">
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

// ── Chart Card ────────────────────────────────────────────────────────────────

function ChartCard({
  title, subtitle, children, empty,
}: {
  title: string; subtitle?: string;
  children: React.ReactNode; empty?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <div className="mb-5">
        <h3 className="font-bold text-gray-900">{title}</h3>
        {subtitle && (
          <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
        )}
      </div>
      {empty ? (
        <div className="h-32 flex items-center justify-center">
          <p className="text-sm text-gray-300">Belum ada data</p>
        </div>
      ) : children}
    </div>
  );
}

// ── Custom pie label ──────────────────────────────────────────────────────────

function renderPieLabel({
  cx, cy, midAngle, innerRadius, outerRadius, percent, name,
}: any) {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x      = cx + radius * Math.cos(-midAngle * RADIAN);
  const y      = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle"
      dominantBaseline="central" fontSize={11} fontWeight="bold">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function StatistikPage() {
  const { data: session } = useSession();
  const { activeRT }      = useRTStore();
  const rtGroupId         = (session?.user as any)?.rt_group_id as string | null;

  const { data: stats, isLoading, isError, refetch } =
    useQuery<DemografiStats>({
      queryKey: ["statistik", rtGroupId],
      queryFn:  async () => {
        const { data } = await apiClient.get(
          `/warga/statistik/${rtGroupId}`
        );
        return data;
      },
      enabled:   !!rtGroupId,
      staleTime: 60_000,
    });

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

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">
          Statistik Demografis
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Data kependudukan warga · {activeRT?.display_name ?? ""}
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      )}

      {isError && (
        <div className="text-center py-12">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <p className="font-bold text-gray-800">Gagal memuat statistik</p>
          <button onClick={() => refetch()}
            className="mt-2 text-sm text-blue-600 hover:underline">
            Coba lagi
          </button>
        </div>
      )}

      {stats && (
        <>
          {/* ── KPI Cards ──────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard
              label="Total Warga"
              value={stats.total_warga}
              sub="Terdaftar & aktif"
              icon={Users}
              color="bg-blue-900 text-white"
            />
            <KpiCard
              label="Kartu Keluarga"
              value={stats.total_kk}
              sub={`Rata-rata ${stats.total_kk
                ? (stats.total_warga / stats.total_kk).toFixed(1)
                : 0} orang/KK`}
              icon={Home}
              color="bg-green-700 text-white"
            />
            <KpiCard
              label="Kepala Keluarga"
              value={stats.kepala_keluarga}
              sub="KK terdaftar"
              icon={UserCheck}
              color="bg-purple-700 text-white"
            />
          </div>

          {/* ── Row 1: Jenis Kelamin + Agama ───────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Jenis Kelamin */}
            <ChartCard
              title="Jenis Kelamin"
              subtitle="Distribusi gender seluruh warga"
              empty={stats.jenis_kelamin.length === 0}
            >
              <div className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={stats.jenis_kelamin}
                      cx="50%" cy="50%"
                      outerRadius={85}
                      dataKey="value"
                      labelLine={false}
                      label={renderPieLabel}
                    >
                      {stats.jenis_kelamin.map((_, i) => (
                        <Cell key={i}
                          fill={GENDER_COLORS[i % GENDER_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                    <Legend
                      formatter={(value) => (
                        <span className="text-xs text-gray-600">{value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-6 mt-2">
                {stats.jenis_kelamin.map((item, i) => (
                  <div key={item.name} className="text-center">
                    <div className="text-2xl font-extrabold"
                      style={{ color: GENDER_COLORS[i % GENDER_COLORS.length] }}>
                      {item.value}
                    </div>
                    <div className="text-xs text-gray-500">{item.name}</div>
                  </div>
                ))}
              </div>
            </ChartCard>

            {/* Agama */}
            <ChartCard
              title="Agama"
              subtitle="Distribusi agama seluruh warga"
              empty={stats.agama.length === 0}
            >
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={stats.agama}
                    cx="50%" cy="50%"
                    outerRadius={85}
                    dataKey="value"
                    labelLine={false}
                    label={renderPieLabel}
                  >
                    {stats.agama.map((_, i) => (
                      <Cell key={i}
                        fill={AGAMA_COLORS[i % AGAMA_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  <Legend
                    formatter={(value) => (
                      <span className="text-xs text-gray-600">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* ── Pendidikan — CRITICAL for Kelurahan ────────────── */}
          <ChartCard
            title="Tingkat Pendidikan"
            subtitle="Data pendidikan terakhir — sering diminta Kelurahan 3x/tahun"
            empty={stats.pendidikan.length === 0}
          >
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1
                rounded-full bg-amber-100 text-amber-800 text-xs font-semibold">
                <GraduationCap className="w-3.5 h-3.5" />
                Data Kelurahan
              </span>
              <span className="text-xs text-gray-400">
                Export untuk laporan ke Kelurahan
              </span>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={stats.pendidikan} barSize={28}
                margin={{ top: 0, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"
                  vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }}
                  axisLine={false} tickLine={false}
                  angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false}
                  tickLine={false} allowDecimals={false} width={24} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" fill={BAR_COLOR}
                  radius={[6, 6, 0, 0]} name="Jumlah" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* ── Row 2: Usia + Status Tinggal ───────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Usia */}
            <ChartCard
              title="Kelompok Usia"
              subtitle="Distribusi usia seluruh warga"
              empty={stats.usia.filter(u => u.name !== "Tidak Diisi").length === 0}
            >
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={stats.usia.filter(u => u.name !== "Tidak Diisi")}
                  barSize={32}
                  margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"
                    vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }}
                    axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false}
                    tickLine={false} allowDecimals={false} width={24} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" fill={BAR_COLOR_2}
                    radius={[6, 6, 0, 0]} name="Jumlah" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Status Tinggal */}
            <ChartCard
              title="Status Tinggal"
              subtitle="TETAP / KONTRAK / KOST / lainnya"
              empty={stats.status_tinggal.length === 0}
            >
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={stats.status_tinggal}
                    cx="50%" cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    dataKey="value"
                    labelLine={false}
                    label={renderPieLabel}
                  >
                    {stats.status_tinggal.map((_, i) => (
                      <Cell key={i}
                        fill={STATUS_COLORS[i % STATUS_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  <Legend
                    formatter={(value) => (
                      <span className="text-xs text-gray-600">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* ── Pekerjaan ───────────────────────────────────────── */}
          <ChartCard
            title="Pekerjaan"
            subtitle="Distribusi pekerjaan seluruh warga"
            empty={stats.pekerjaan.length === 0}
          >
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.pekerjaan} barSize={28}
                margin={{ top: 0, right: 10, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"
                  vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }}
                  axisLine={false} tickLine={false}
                  angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false}
                  tickLine={false} allowDecimals={false} width={24} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" fill="#8b5cf6"
                  radius={[6, 6, 0, 0]} name="Jumlah" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* ── Kewarganegaraan ─────────────────────────────────── */}
          {stats.kewarganegaraan.length > 0 && (
            <ChartCard
              title="Kewarganegaraan"
              subtitle="WNI vs WNA"
            >
              <div className="flex items-center justify-center gap-8">
                {stats.kewarganegaraan.map((item, i) => (
                  <div key={item.name} className="text-center">
                    <div
                      className="w-20 h-20 rounded-2xl flex items-center
                        justify-center mx-auto mb-2"
                      style={{
                        background: KWRG_COLORS[i % KWRG_COLORS.length],
                      }}
                    >
                      <span className="text-2xl font-extrabold text-white">
                        {item.value}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-gray-700">
                      {item.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {((item.value / stats.total_warga) * 100).toFixed(0)}%
                    </p>
                  </div>
                ))}
              </div>
            </ChartCard>
          )}

          {/* ── Data completeness warning ───────────────────────── */}
          {stats.total_warga > 0 && (
            <div className="bg-amber-50 border border-amber-200
              rounded-2xl p-5">
              <p className="text-sm font-bold text-amber-800 mb-2">
                💡 Tips Kelengkapan Data
              </p>
              <p className="text-xs text-amber-700 leading-relaxed">
                Minta warga untuk melengkapi profil (pendidikan, pekerjaan,
                tanggal lahir) agar statistik lebih akurat.
                Kelurahan sering meminta data ini 2-3x per tahun.
                Warga dapat mengisi di menu <strong>Profil Saya</strong> dan
                <strong> Anggota Keluarga</strong>.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
