"use client";
// app/(admin)/warga/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Data Warga — admin sees all RT members, verifies pending, suspends bad actors
//
// Features:
//   - Filter tabs: Semua / Pending / Aktif / Disuspend
//   - Search by name or email
//   - Verify pending warga with one click
//   - Suspend active warga
//   - Role badge (warga / admin_rt)
//   - Pending count badge on tab
//   - Empty states per filter
//   - Optimistic UI updates
// ─────────────────────────────────────────────────────────────────────────────

import {
  formatDate,
  getWargaList,
  suspendWarga,
  verifyWarga,
  type WargaFilter,
  type WargaUser,
} from "@/lib/api/warga";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle,
  Clock,
  RefreshCw,
  Search,
  Shield,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

const FILTERS: { key: WargaFilter; label: string; icon: React.ReactNode }[] = [
  { key: "all",       label: "Semua",     icon: <Users      className="w-3.5 h-3.5" /> },
  { key: "pending",   label: "Pending",   icon: <Clock      className="w-3.5 h-3.5" /> },
  { key: "active",    label: "Aktif",     icon: <CheckCircle className="w-3.5 h-3.5" /> },
  { key: "suspended", label: "Disuspend", icon: <XCircle    className="w-3.5 h-3.5" /> },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: WargaUser["status"] }) {
  const config = {
    pending:   { label: "Pending",    cls: "bg-amber-100  text-amber-800"  },
    active:    { label: "Aktif",      cls: "bg-green-100  text-green-800"  },
    suspended: { label: "Disuspend",  cls: "bg-red-100    text-red-700"    },
  }[status];

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${config.cls}`}>
      {config.label}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  const isAdmin = role === "admin_rt" || role === "admin_rw";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
      ${isAdmin ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-600"}`}>
      {isAdmin && <Shield className="w-3 h-3" />}
      {role.replace("_", " ")}
    </span>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase();
  const colors   = [
    "bg-blue-500",  "bg-green-500",  "bg-purple-500",
    "bg-orange-500","bg-pink-500",   "bg-teal-500",
  ];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className={`w-9 h-9 rounded-full ${color} flex items-center justify-center
      text-white text-sm font-bold flex-shrink-0`}>
      {initials}
    </div>
  );
}

function EmptyState({ filter }: { filter: WargaFilter }) {
  const config = {
    all:       { icon: "👥", title: "Belum ada warga",        desc: "Warga yang mendaftar akan muncul di sini."             },
    pending:   { icon: "🎉", title: "Tidak ada pending",      desc: "Semua pendaftar sudah diverifikasi. Kerja bagus!"      },
    active:    { icon: "👍", title: "Belum ada warga aktif",  desc: "Verifikasi warga pending untuk mengaktifkan mereka."   },
    suspended: { icon: "✅", title: "Tidak ada yang disuspend", desc: "Tidak ada warga yang disuspend saat ini."            },
  }[filter];

  return (
    <div className="text-center py-16">
      <div className="text-5xl mb-4">{config.icon}</div>
      <h3 className="text-base font-bold text-gray-800 mb-1">{config.title}</h3>
      <p className="text-sm text-gray-500">{config.desc}</p>
    </div>
  );
}

function WargaSkeleton() {
  return (
    <div className="animate-pulse">
      {[1,2,3,4,5].map(i => (
        <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-gray-100">
          <div className="w-9 h-9 rounded-full bg-gray-200" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-1/4" />
            <div className="h-3 bg-gray-100 rounded w-1/3" />
          </div>
          <div className="h-6 w-16 bg-gray-200 rounded-full" />
          <div className="h-8 w-20 bg-gray-100 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

// ── Warga Row ─────────────────────────────────────────────────────────────────

function WargaRow({
  user,
  onVerify,
  onSuspend,
  isLoading,
}: {
  user:      WargaUser;
  onVerify:  (id: string) => void;
  onSuspend: (id: string) => void;
  isLoading: boolean;
}) {
  return (
    <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-100
      hover:bg-gray-50 transition-colors group">

      {/* Avatar + Name */}
      <Avatar name={user.full_name} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{user.full_name}</p>
        <p className="text-xs text-gray-500 truncate">{user.email}</p>
        {user.phone && (
          <p className="text-xs text-gray-400">{user.phone}</p>
        )}
      </div>

      {/* Role */}
      <div className="hidden sm:block">
        <RoleBadge role={user.role} />
      </div>

      {/* Status */}
      <StatusBadge status={user.status} />

      {/* Joined date */}
      <div className="hidden lg:block text-xs text-gray-400 w-24 text-right">
        {formatDate(user.created_at)}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {user.status === "pending" && (
          <button
            onClick={() => onVerify(user.id)}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700 text-white
              text-xs font-semibold rounded-lg hover:bg-green-600 disabled:opacity-50
              disabled:cursor-not-allowed transition-colors"
          >
            <UserCheck className="w-3.5 h-3.5" />
            Verifikasi
          </button>
        )}
        {user.status === "active" && user.role !== "admin_rt" && (
          <button
            onClick={() => onSuspend(user.id)}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-red-600
              text-xs font-semibold rounded-lg border border-red-200 hover:bg-red-50
              disabled:opacity-50 disabled:cursor-not-allowed transition-colors
              opacity-0 group-hover:opacity-100"
          >
            <XCircle className="w-3.5 h-3.5" />
            Suspend
          </button>
        )}
        {user.status === "suspended" && (
          <button
            onClick={() => onVerify(user.id)}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-blue-700
              text-xs font-semibold rounded-lg border border-blue-200 hover:bg-blue-50
              disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Aktifkan
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function WargaPage() {
  const { data: session }  = useSession();
  const queryClient        = useQueryClient();
  const rtGroupId          = (session?.user as any)?.rt_group_id as string | null;

  const [filter, setFilter]   = useState<WargaFilter>("all");
  const [search, setSearch]   = useState("");
  const [actionId, setActionId] = useState<string | null>(null);

  // ── Fetch warga list ──────────────────────────────────────────
  const { data: wargaList = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["warga", rtGroupId, filter],
    queryFn:  () => getWargaList(rtGroupId!, filter),
    enabled:  !!rtGroupId,
    staleTime: 30_000,
  });

  // ── Verify mutation ───────────────────────────────────────────
  const verifyMutation = useMutation({
    mutationFn: verifyWarga,
    onMutate: (userId) => setActionId(userId),
    onSuccess: (updated) => {
      toast.success(`✅ ${updated.full_name ?? "Warga"} berhasil diverifikasi`);
      queryClient.invalidateQueries({ queryKey: ["warga", rtGroupId] });
    },
    onError: () => toast.error("Gagal memverifikasi warga"),
    onSettled: () => setActionId(null),
  });

  // ── Suspend mutation ──────────────────────────────────────────
  const suspendMutation = useMutation({
    mutationFn: suspendWarga,
    onMutate: (userId) => setActionId(userId),
    onSuccess: (updated) => {
      toast.success(`⚠️ ${updated.full_name ?? "Warga"} disuspend`);
      queryClient.invalidateQueries({ queryKey: ["warga", rtGroupId] });
    },
    onError: () => toast.error("Gagal mensuspend warga"),
    onSettled: () => setActionId(null),
  });

  // ── Filter + search ───────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!search.trim()) return wargaList;
    const q = search.toLowerCase();
    return wargaList.filter(
      w => w.full_name.toLowerCase().includes(q) ||
           w.email.toLowerCase().includes(q) ||
           (w.phone ?? "").includes(q)
    );
  }, [wargaList, search]);

  // ── Pending count for badge ───────────────────────────────────
  const { data: allWarga = [] } = useQuery({
    queryKey: ["warga", rtGroupId, "all"],
    queryFn:  () => getWargaList(rtGroupId!, "all"),
    enabled:  !!rtGroupId,
    staleTime: 30_000,
  });
  const pendingCount = allWarga.filter(w => w.status === "pending").length;

  // ── No RT group ───────────────────────────────────────────────
  if (!rtGroupId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-4xl mb-3">⚙️</div>
          <p className="font-bold text-gray-800">RT belum dikonfigurasi</p>
          <p className="text-sm text-gray-500 mt-1">
            Buka <a href="/pengaturan" className="text-blue-600 underline">Pengaturan</a> untuk setup RT Anda terlebih dahulu.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── Stats row ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Warga", value: allWarga.length,                              color: "text-blue-900",  bg: "bg-blue-50"   },
          { label: "Pending",     value: allWarga.filter(w=>w.status==="pending").length,   color: "text-amber-700", bg: "bg-amber-50"  },
          { label: "Aktif",       value: allWarga.filter(w=>w.status==="active").length,    color: "text-green-700", bg: "bg-green-50"  },
          { label: "Disuspend",   value: allWarga.filter(w=>w.status==="suspended").length, color: "text-red-700",   bg: "bg-red-50"    },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4`}>
            <div className={`text-2xl font-extrabold ${s.color}`}>{s.value}</div>
            <div className="text-xs font-medium text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Main card ────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

        {/* Toolbar */}
        <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row
          items-start sm:items-center gap-3">

          {/* Filter tabs */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 flex-shrink-0">
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
                {f.icon}
                {f.label}
                {f.key === "pending" && pendingCount > 0 && (
                  <span className="ml-1 bg-amber-500 text-white text-[10px] font-bold
                    w-4 h-4 rounded-full flex items-center justify-center">
                    {pendingCount > 9 ? "9+" : pendingCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari nama, email, HP..."
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 text-sm
                bg-gray-50 focus:bg-white focus:border-blue-400 focus:ring-2
                focus:ring-blue-100 outline-none transition-colors"
            />
          </div>

          {/* Refresh */}
          <button
            onClick={() => refetch()}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600
              hover:bg-gray-100 transition-colors flex-shrink-0"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Table header */}
        <div className="hidden lg:flex items-center gap-4 px-6 py-2.5 bg-gray-50
          border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          <div className="w-9" />
          <div className="flex-1">Warga</div>
          <div className="w-24">Role</div>
          <div className="w-20">Status</div>
          <div className="w-24 text-right">Bergabung</div>
          <div className="w-28 text-right">Aksi</div>
        </div>

        {/* Content */}
        {isLoading ? (
          <WargaSkeleton />
        ) : isError ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">😕</div>
            <p className="font-bold text-gray-800">Gagal memuat data warga</p>
            <button
              onClick={() => refetch()}
              className="mt-3 text-sm text-blue-600 hover:underline"
            >
              Coba lagi
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState filter={search ? "all" : filter} />
        ) : (
          <div>
            {filtered.map(user => (
              <WargaRow
                key={user.id}
                user={user}
                onVerify={(id) => verifyMutation.mutate(id)}
                onSuspend={(id) => suspendMutation.mutate(id)}
                isLoading={actionId === user.id}
              />
            ))}
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
              <p className="text-xs text-gray-400">
                Menampilkan {filtered.length} dari {wargaList.length} warga
                {search && ` — hasil pencarian "${search}"`}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Pending alert banner */}
      {pendingCount > 0 && filter !== "pending" && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3
          flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-800">
              <span className="font-bold">{pendingCount} warga</span> menunggu verifikasi
            </p>
          </div>
          <button
            onClick={() => setFilter("pending")}
            className="text-xs font-semibold text-amber-700 hover:text-amber-900
              bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors
              flex-shrink-0"
          >
            Lihat Sekarang →
          </button>
        </div>
      )}
    </div>
  );
}
