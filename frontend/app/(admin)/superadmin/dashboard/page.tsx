// app/(admin)/superadmin/dashboard/page.tsx
"use client";

/**
 * Superadmin platform dashboard.
 *
 * Shows platform-wide health — NOT scoped to any single RT.
 * Deliberately has NO Ketua RT tools (no WA, no tagihan, no warga list).
 *
 * Wires to: GET /onboarding/platform-stats (superadmin only)
 */

import { useAuth } from "@/lib/hooks/useAuth";
import apiClient from "@/lib/api/client";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Users,
  Building2,
  XCircle,
  ChevronRight,
  Loader2,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlatformStats {
  rt_groups: {
    total:    number;
    active:   number;
    pending:  number;
    rejected: number;
    expired:  number;
  };
  total_users:  number;
  total_warga:  number;
  recent_rts: {
    id:                  string;
    rt_identity:         string;
    admin_name:          string;
    verification_status: string;
    created_at:          string;
  }[];
}

// ─── API ──────────────────────────────────────────────────────────────────────

async function fetchPlatformStats(): Promise<PlatformStats> {
  const { data } = await apiClient.get<PlatformStats>("/onboarding/platform-stats");
  return data;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon: Icon, color,
}: {
  label:  string;
  value:  number;
  sub:    string;
  icon:   any;
  color:  "green" | "amber" | "red" | "blue" | "gray";
}) {
  const colors = {
    green: { bg: "bg-green-50",  text: "text-green-700",  val: "text-green-700"  },
    amber: { bg: "bg-amber-50",  text: "text-amber-600",  val: "text-amber-700"  },
    red:   { bg: "bg-red-50",    text: "text-red-600",    val: "text-red-700"    },
    blue:  { bg: "bg-blue-50",   text: "text-blue-700",   val: "text-blue-800"   },
    gray:  { bg: "bg-gray-100",  text: "text-gray-500",   val: "text-gray-700"   },
  }[color];

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-500">{label}</span>
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", colors.bg)}>
          <Icon className={cn("w-4 h-4", colors.text)} />
        </div>
      </div>
      <div className={cn("text-3xl font-extrabold", colors.val)}>{value.toLocaleString("id-ID")}</div>
      <div className="text-xs text-gray-400 mt-1">{sub}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    active:               "bg-green-100 text-green-700 border-green-200",
    pending_verification: "bg-amber-100 text-amber-700 border-amber-200",
    rejected:             "bg-red-100   text-red-700   border-red-200",
    expired:              "bg-gray-100  text-gray-600  border-gray-200",
  };
  const labels: Record<string, string> = {
    active:               "Aktif",
    pending_verification: "Menunggu",
    rejected:             "Ditolak",
    expired:              "Kedaluwarsa",
  };
  return (
    <span className={cn(
      "text-xs px-2 py-0.5 rounded-full font-medium border",
      cfg[status] ?? "bg-gray-100 text-gray-600 border-gray-200"
    )}>
      {labels[status] ?? status}
    </span>
  );
}

function RTAvatar({ name }: { name: string }) {
  const initials = (name || "R").split(" ").slice(0, 2)
    .map((n: string) => n[0]).join("").toUpperCase();
  return (
    <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center
                    text-white text-xs font-bold flex-shrink-0">
      {initials}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SuperadminDashboardPage() {
  const { role }  = useAuth();
  const router    = useRouter();

  // Guard — belt-and-suspenders on top of layout.tsx guard
  useEffect(() => {
    if (role && role !== "superadmin") router.replace("/dashboard");
  }, [role, router]);

  const {
    data,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey:      ["platform-stats"],
    queryFn:       fetchPlatformStats,
    refetchInterval: 60_000,   // refresh every 60s
    staleTime:     30_000,
  });

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 11) return "Selamat pagi";
    if (h < 15) return "Selamat siang";
    if (h < 18) return "Selamat sore";
    return "Selamat malam";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <XCircle className="w-10 h-10 text-red-400 mb-3" />
        <p className="text-sm font-medium text-gray-800 mb-1">Gagal memuat statistik platform</p>
        <p className="text-xs text-gray-500 mb-4">Pastikan Anda login sebagai superadmin</p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm
                     hover:bg-gray-700 transition-colors"
        >
          Coba lagi
        </button>
      </div>
    );
  }

  const { rt_groups, total_users, total_warga, recent_rts } = data;

  return (
    <div className="space-y-6 max-w-5xl">

      {/* ── Welcome banner ─────────────────────────────────────────────── */}
      <div className="bg-gray-900 rounded-2xl px-6 py-5 text-white
                      flex items-center justify-between">
        <div>
          <p className="text-gray-400 text-sm">{greeting()},</p>
          <h2 className="font-bold text-2xl mt-0.5">RTMudah Superadmin 👋</h2>
          <p className="text-gray-400 text-sm mt-1">
            {rt_groups.total} RT terdaftar · {total_warga.toLocaleString("id-ID")} warga total
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-700
                     text-sm text-gray-300 hover:bg-gray-800 transition-colors
                     disabled:opacity-50"
        >
          <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* ── Pending verification alert ──────────────────────────────────── */}
      {rt_groups.pending > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4
                        flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-800">
                {rt_groups.pending} RT menunggu verifikasi
              </p>
              <p className="text-xs text-amber-600 mt-0.5">
                Target SLA: review dalam 24 jam
              </p>
            </div>
          </div>
          <Link
            href="/superadmin/verifikasi"
            className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl
                       bg-amber-500 hover:bg-amber-400 text-white text-sm font-medium
                       transition-colors"
          >
            Review Sekarang
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* ── Platform stats grid ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="RT Aktif"
          value={rt_groups.active}
          sub={`dari ${rt_groups.total} total RT`}
          icon={CheckCircle}
          color="green"
        />
        <StatCard
          label="Menunggu Verifikasi"
          value={rt_groups.pending}
          sub="perlu review"
          icon={Clock}
          color={rt_groups.pending > 0 ? "amber" : "gray"}
        />
        <StatCard
          label="Total Pengguna"
          value={total_users}
          sub="semua role"
          icon={Users}
          color="blue"
        />
        <StatCard
          label="Total Warga"
          value={total_warga}
          sub="seluruh RT"
          icon={Building2}
          color="blue"
        />
      </div>

      {/* ── Secondary stats row ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard
          label="RT Ditolak"
          value={rt_groups.rejected}
          sub="perlu tindak lanjut"
          icon={XCircle}
          color={rt_groups.rejected > 0 ? "red" : "gray"}
        />
        <StatCard
          label="RT Kedaluwarsa"
          value={rt_groups.expired}
          sub="SK perlu diperbarui"
          icon={AlertTriangle}
          color={rt_groups.expired > 0 ? "amber" : "gray"}
        />
      </div>

      {/* ── Recent RT registrations ─────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-900 text-sm">Pendaftaran RT Terbaru</h3>
            <p className="text-xs text-gray-400 mt-0.5">5 RT terdaftar terakhir</p>
          </div>
          <Link
            href="/superadmin/verifikasi"
            className="text-xs text-blue-600 flex items-center gap-1
                       font-medium hover:text-blue-800 transition-colors"
          >
            Lihat antrian
            <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="divide-y divide-gray-100">
          {recent_rts.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-gray-400">
              Belum ada RT terdaftar
            </div>
          ) : (
            recent_rts.map((rt) => {
              const date = new Date(rt.created_at).toLocaleDateString("id-ID", {
                day: "numeric", month: "short", year: "numeric",
              });
              return (
                <div key={rt.id}
                  className="px-5 py-3.5 flex items-center gap-4 hover:bg-gray-50 transition-colors">
                  <RTAvatar name={rt.admin_name} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {rt.rt_identity}
                    </p>
                    <p className="text-xs text-gray-400 truncate mt-0.5">
                      {rt.admin_name} · {date}
                    </p>
                  </div>
                  <StatusBadge status={rt.verification_status} />
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Quick actions ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/superadmin/verifikasi"
          className="flex items-center gap-4 bg-white rounded-xl border border-gray-200
                     shadow-sm p-5 hover:border-orange-300 hover:shadow-md transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center
                          group-hover:bg-orange-100 transition-colors flex-shrink-0">
            <Clock className="w-5 h-5 text-orange-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Antrian Verifikasi</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {rt_groups.pending > 0
                ? `${rt_groups.pending} RT menunggu review`
                : "Tidak ada antrian saat ini"}
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300 ml-auto group-hover:text-orange-400
                                   transition-colors" />
        </Link>

        <div className="flex items-center gap-4 bg-white rounded-xl border border-gray-200
                        shadow-sm p-5 opacity-50 cursor-not-allowed">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Manajemen Pengguna</p>
            <p className="text-xs text-gray-400 mt-0.5">Coming soon</p>
          </div>
        </div>
      </div>

    </div>
  );
}
