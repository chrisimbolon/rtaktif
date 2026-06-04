"use client";
// app/(admin)/warga/page.tsx
// Updated: clickable warga rows → KK detail modal
// Shows full profile + all KK members when available

import {
  formatDate,
  getWargaFullProfile,
  getWargaList,
  suspendWarga,
  verifyWarga,
  type ResidentDetail,
  type WargaFilter,
  type WargaUser,
} from "@/lib/api/warga";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle, ChevronRight, Clock,
  Home, Loader2, RefreshCw, Search,
  UserCheck, Users, X, XCircle
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

const FILTERS: { key: WargaFilter; label: string; icon: React.ReactNode }[] = [
  { key: "all",       label: "Semua",     icon: <Users       className="w-3.5 h-3.5" /> },
  { key: "pending",   label: "Pending",   icon: <Clock       className="w-3.5 h-3.5" /> },
  { key: "active",    label: "Aktif",     icon: <CheckCircle className="w-3.5 h-3.5" /> },
  { key: "suspended", label: "Disuspend", icon: <XCircle     className="w-3.5 h-3.5" /> },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: WargaUser["status"] }) {
  const cfg = {
    active:    "bg-green-100 text-green-800",
    pending:   "bg-amber-100 text-amber-800",
    suspended: "bg-red-100   text-red-700",
  }[status] ?? "bg-gray-100 text-gray-500";

  const label = { active: "Aktif", pending: "Pending", suspended: "Disuspend" }[status] ?? status;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full
      text-xs font-semibold ${cfg}`}>
      {label}
    </span>
  );
}

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const s        = name || "W";
  const initials = s.split(" ").slice(0, 2).map((n: string) => n[0]).join("").toUpperCase();
  const colors   = ["bg-blue-500","bg-green-500","bg-purple-500",
                    "bg-orange-500","bg-pink-500","bg-teal-500"];
  const sz       = size === "sm" ? "w-7 h-7 text-xs" : "w-9 h-9 text-sm";
  return (
    <div className={`${sz} rounded-full ${colors[s.charCodeAt(0) % colors.length]}
      flex items-center justify-center text-white font-bold flex-shrink-0`}>
      {initials}
    </div>
  );
}

function DataRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 w-32 flex-shrink-0">{label}</span>
      <span className="text-xs font-medium text-gray-800 flex-1">{value}</span>
    </div>
  );
}

// ── KK Member Card ────────────────────────────────────────────────────────────

function KKMemberCard({
  member, isMain = false,
}: {
  member: ResidentDetail; isMain?: boolean;
}) {
  const [expanded, setExpanded] = useState(isMain);

  return (
    <div className={`rounded-xl border ${
      isMain ? "border-blue-200 bg-blue-50" : "border-gray-200 bg-white"
    } overflow-hidden`}>
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left
          hover:bg-black/5 transition-colors"
      >
        <Avatar name={member.full_name} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 truncate">
            {member.full_name}
            {member.kepala_keluarga && (
              <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5
                rounded-full bg-blue-900 text-white">KK</span>
            )}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {member.hubungan_dengan_kk ?? member.status_keluarga ?? "—"}
            {member.pendidikan_terakhir && ` · ${member.pendidikan_terakhir}`}
          </p>
        </div>
        <ChevronRight className={`w-4 h-4 text-gray-400 flex-shrink-0
          transition-transform ${expanded ? "rotate-90" : ""}`} />
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100">
          <div className="mt-3 grid grid-cols-1 gap-0">
            <DataRow label="NIK"             value={member.nik} />
            <DataRow label="No. KK"          value={member.no_kk} />
            <DataRow label="Tempat Lahir"    value={member.tempat_lahir} />
            <DataRow label="Tanggal Lahir"   value={member.tanggal_lahir
              ? new Date(member.tanggal_lahir).toLocaleDateString("id-ID", {
                  day: "numeric", month: "long", year: "numeric"
                })
              : null}
            />
            <DataRow label="Jenis Kelamin"   value={member.jenis_kelamin} />
            <DataRow label="Agama"           value={member.agama} />
            <DataRow label="Pendidikan"      value={member.pendidikan_terakhir} />
            <DataRow label="Pekerjaan"       value={member.pekerjaan} />
            <DataRow label="Status Kawin"    value={member.status_kawin} />
            <DataRow label="Status Tinggal"  value={member.status_tinggal} />
            <DataRow label="Kewarganegaraan" value={member.kewarganegaraan} />
            <DataRow label="Hubungan KK"     value={member.hubungan_dengan_kk} />
            <DataRow label="Alamat KTP"      value={member.alamat_ktp} />
            <DataRow label="No. HP"          value={member.phone} />
            <DataRow label="Blok/Unit"       value={member.block_unit} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── KK Detail Modal ───────────────────────────────────────────────────────────

function KKDetailModal({
  user,
  onClose,
}: {
  user:    WargaUser;
  onClose: () => void;
}) {
  const { data: profile, isLoading } = useQuery<ResidentDetail>({
    queryKey: ["warga-profile", user.id],
    queryFn:  () => getWargaFullProfile(user.id),
    staleTime: 60_000,
  });

  const completeness = useMemo(() => {
    if (!profile) return 0;
    const fields = [
      profile.nik, profile.no_kk, profile.tanggal_lahir,
      profile.tempat_lahir, profile.jenis_kelamin, profile.agama,
      profile.pekerjaan, profile.status_kawin, profile.pendidikan_terakhir,
      profile.hubungan_dengan_kk, profile.kewarganegaraan,
    ];
    const filled = fields.filter(Boolean).length;
    return Math.round((filled / fields.length) * 100);
  }, [profile]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center
      z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg my-4">

        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center
          justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar name={user.full_name} />
            <div>
              <h3 className="font-bold text-gray-900">{user.full_name}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{user.email}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600
              hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {isLoading ? (
            <div className="py-12 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : !profile ? (
            <div className="py-8 text-center">
              <Home className="w-8 h-8 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-700">
                Data kependudukan belum diisi
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Warga belum melengkapi profil
              </p>
            </div>
          ) : (
            <>
              {/* Profile completeness */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-700">
                    Kelengkapan Data
                  </p>
                  <span className={`text-xs font-bold ${
                    completeness >= 80 ? "text-green-600" :
                    completeness >= 50 ? "text-amber-600" : "text-red-500"
                  }`}>
                    {completeness}%
                  </span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      completeness >= 80 ? "bg-green-500" :
                      completeness >= 50 ? "bg-amber-500" : "bg-red-400"
                    }`}
                    style={{ width: `${completeness}%` }}
                  />
                </div>
                {profile.no_kk && (
                  <p className="text-xs text-gray-500 mt-2">
                    No. KK: <span className="font-mono font-semibold">
                      {profile.no_kk}
                    </span>
                  </p>
                )}
              </div>

              {/* Main resident */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase
                  tracking-wider mb-2">
                  Data Pribadi
                </p>
                <KKMemberCard member={profile} isMain={true} />
              </div>

              {/* KK Members */}
              {profile.kk_members && profile.kk_members.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase
                    tracking-wider mb-2">
                    Anggota KK ({profile.kk_members.length} orang)
                  </p>
                  <div className="space-y-2">
                    {profile.kk_members.map((m: ResidentDetail) => (
                      <KKMemberCard key={m.id} member={m} />
                    ))}
                  </div>
                </div>
              )}

              {/* No KK members info */}
              {(!profile.kk_members || profile.kk_members.length === 0) &&
               profile.no_kk && (
                <div className="bg-amber-50 border border-amber-200
                  rounded-xl p-3 text-center">
                  <p className="text-xs text-amber-700">
                    Belum ada anggota KK lain terdaftar di RTMudah
                    dengan No. KK yang sama
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100">
          <button onClick={onClose}
            className="w-full py-2.5 rounded-xl border border-gray-200
              text-sm font-semibold text-gray-700 hover:bg-gray-50
              transition-colors">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Warga Row ─────────────────────────────────────────────────────────────────

function WargaRow({
  user, rtGroupId, onVerify, onSuspend, isActionLoading,
  onViewProfile,
}: {
  user:            WargaUser;
  rtGroupId:       string;
  onVerify:        (id: string) => void;
  onSuspend:       (id: string) => void;
  isActionLoading: boolean;
  onViewProfile:   (user: WargaUser) => void;
}) {
  return (
    <tr
      onClick={() => onViewProfile(user)}
      className="border-b border-gray-50 hover:bg-blue-50/40
        transition-colors cursor-pointer group"
    >
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <Avatar name={user.full_name} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate
              group-hover:text-blue-700 transition-colors">
              {user.full_name}
            </p>
            <p className="text-xs text-gray-500 truncate">{user.email}</p>
            {user.phone && (
              <p className="text-xs text-gray-400">{user.phone}</p>
            )}
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full
          text-xs font-semibold bg-gray-100 text-gray-700">
          {user.role === "ketua_rt" ? "ketua rt" : user.role}
        </span>
      </td>
      <td className="px-6 py-4">
        <StatusBadge status={user.status} />
      </td>
      <td className="px-6 py-4 text-xs text-gray-500 whitespace-nowrap">
        {formatDate(user.created_at)}
      </td>
      <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 justify-end">
          {user.status === "pending" && (
            <button
              onClick={() => onVerify(user.id)}
              disabled={isActionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700
                text-white text-xs font-semibold rounded-lg
                hover:bg-green-600 disabled:opacity-50 transition-colors"
            >
              <UserCheck className="w-3.5 h-3.5" />
              Verifikasi
            </button>
          )}
          {user.status === "active" && user.role !== "ketua_rt" && (
            <button
              onClick={() => onSuspend(user.id)}
              disabled={isActionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 border
                border-red-200 text-red-600 text-xs font-semibold rounded-lg
                hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" />
              Suspend
            </button>
          )}
          {user.status === "suspended" && (
            <button
              onClick={() => onVerify(user.id)}
              disabled={isActionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 border
                border-green-200 text-green-700 text-xs font-semibold
                rounded-lg hover:bg-green-50 disabled:opacity-50
                transition-colors"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              Aktifkan
            </button>
          )}
          <ChevronRight className="w-4 h-4 text-gray-300
            group-hover:text-blue-400 transition-colors" />
        </div>
      </td>
    </tr>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function WargaPage() {
  const { data: session }  = useSession();
  const queryClient        = useQueryClient();
  const rtGroupId          = (session?.user as any)?.rt_group_id as string | null;

  const [filter,   setFilter]   = useState<WargaFilter>("all");
  const [search,   setSearch]   = useState("");
  const [actionId, setActionId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<WargaUser | null>(null);

  const { data: wargaList = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["warga", rtGroupId, filter],
    queryFn:  () => getWargaList(rtGroupId!, filter),
    enabled:  !!rtGroupId,
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return wargaList;
    const q = search.toLowerCase();
    return wargaList.filter(w =>
      w.full_name.toLowerCase().includes(q) ||
      w.email.toLowerCase().includes(q) ||
      (w.phone ?? "").includes(q)
    );
  }, [wargaList, search]);

  const pendingCount = wargaList.filter(w => w.status === "pending").length;

  const stats = useMemo(() => ({
    total:     wargaList.length,
    pending:   wargaList.filter(w => w.status === "pending").length,
    active:    wargaList.filter(w => w.status === "active").length,
    suspended: wargaList.filter(w => w.status === "suspended").length,
  }), [wargaList]);

  const verifyMutation = useMutation({
    mutationFn: (id: string) => verifyWarga(id),
    onMutate:   (id) => setActionId(id),
    onSuccess:  (_, id) => {
      toast.success("✅ Warga berhasil diverifikasi!");
      queryClient.invalidateQueries({ queryKey: ["warga", rtGroupId] });
    },
    onError: () => toast.error("Gagal memverifikasi warga"),
    onSettled: () => setActionId(null),
  });

  const suspendMutation = useMutation({
    mutationFn: (id: string) => suspendWarga(id),
    onMutate:   (id) => setActionId(id),
    onSuccess:  () => {
      toast.success("Warga disuspend");
      queryClient.invalidateQueries({ queryKey: ["warga", rtGroupId] });
    },
    onError: () => toast.error("Gagal mensuspend warga"),
    onSettled: () => setActionId(null),
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
    <div className="space-y-5">

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Warga",  value: stats.total,     bg: "bg-blue-50  text-blue-900"  },
          { label: "Pending",      value: stats.pending,   bg: "bg-amber-50 text-amber-800" },
          { label: "Aktif",        value: stats.active,    bg: "bg-green-50 text-green-800" },
          { label: "Disuspend",    value: stats.suspended, bg: "bg-red-50   text-red-800"   },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4`}>
            <div className="text-2xl font-extrabold">{s.value}</div>
            <div className="text-xs font-semibold mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Main card */}
      <div className="bg-white rounded-2xl border border-gray-200
        shadow-sm overflow-hidden">

        {/* Toolbar */}
        <div className="px-6 py-4 border-b border-gray-100 flex flex-col
          sm:flex-row items-start sm:items-center gap-3">

          {/* Filter tabs */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md
                  text-xs font-semibold transition-all ${
                    filter === f.key
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
              >
                {f.icon}
                {f.label}
                {f.key === "pending" && pendingCount > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5
                    rounded-full bg-amber-500 text-white">
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2
              w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari nama, email, HP..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200
                text-sm bg-gray-50 focus:outline-none focus:ring-2
                focus:ring-blue-100 focus:border-blue-400"
            />
          </div>

          <button onClick={() => refetch()}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600
              hover:bg-gray-100 transition-colors flex-shrink-0">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Click hint */}
        <div className="px-6 py-2 bg-blue-50 border-b border-blue-100">
          <p className="text-xs text-blue-600">
            💡 Klik nama warga untuk melihat detail data KK dan kependudukan
          </p>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="py-12 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        ) : isError ? (
          <div className="text-center py-12">
            <p className="font-bold text-gray-800">Gagal memuat data</p>
            <button onClick={() => refetch()}
              className="mt-2 text-sm text-blue-600 hover:underline">
              Coba lagi
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">👥</div>
            <p className="font-bold text-gray-800">
              {search ? "Tidak ada hasil pencarian" : "Belum ada warga"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {["Warga", "Role", "Status", "Bergabung", "Aksi"].map(h => (
                    <th key={h}
                      className="px-6 py-3 text-left text-xs font-semibold
                        text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(user => (
                  <WargaRow
                    key={user.id}
                    user={user}
                    rtGroupId={rtGroupId}
                    onVerify={(id) => verifyMutation.mutate(id)}
                    onSuspend={(id) => suspendMutation.mutate(id)}
                    isActionLoading={actionId === user.id}
                    onViewProfile={setSelectedUser}
                  />
                ))}
              </tbody>
            </table>
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
              <p className="text-xs text-gray-400">
                Menampilkan {filtered.length} dari {wargaList.length} warga
              </p>
            </div>
          </div>
        )}
      </div>

      {/* KK Detail Modal */}
      {selectedUser && (
        <KKDetailModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </div>
  );
}
