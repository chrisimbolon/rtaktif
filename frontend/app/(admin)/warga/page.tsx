// app/(admin)/warga/page.tsx
"use client";
import { useState }                          from "react";
import { useWargaList, useVerifyWarga, useMoveOutWarga } from "@/lib/hooks/useWarga";
import { Avatar }                            from "@/components/ui/avatar";
import { StatusBadge }                       from "@/components/ui/badge";
import { StatCard }                          from "@/components/ui/stat-card";
import { getStatusVariant, formatDate }      from "@/lib/utils";
import { cn }                                from "@/lib/utils";
import {
  Users, UserCheck, UserX, Clock,
  Search, Loader2, CheckCircle2, X,
  Phone, Home, Calendar,
} from "lucide-react";
import type { Resident } from "@/types";

// ── Confirm Dialog ─────────────────────────────────────────────────
function ConfirmDialog({ title, message, onConfirm, onCancel, loading }: {
  title: string; message: string;
  onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-sm p-6">
        <h3 className="font-bold text-gray-900 text-lg mb-2">{title}</h3>
        <p className="text-sm text-gray-500 mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            Batal
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-700 text-white text-sm font-medium hover:bg-green-600 transition-colors disabled:opacity-60">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Konfirmasi
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Resident Detail Panel ──────────────────────────────────────────
function ResidentPanel({ resident, onClose }: { resident: Resident; onClose: () => void }) {
  const verifyMutation  = useVerifyWarga();
  const moveOutMutation = useMoveOutWarga();
  const [confirmVerify,  setConfirmVerify]  = useState(false);
  const [confirmMoveOut, setConfirmMoveOut] = useState(false);

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-end">
        <div className="absolute inset-0 bg-black/20" onClick={onClose} />
        <div className="relative bg-white w-full max-w-md h-full shadow-xl overflow-y-auto animate-slide-left">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
            <h3 className="font-bold text-gray-900">Detail Warga</h3>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Identity */}
            <div className="flex items-start gap-4">
              <Avatar name={resident.full_name} size="lg" />
              <div>
                <h4 className="font-bold text-gray-900 text-lg">{resident.full_name}</h4>
                <StatusBadge status={resident.status} variant={getStatusVariant(resident.status)} />
              </div>
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-1 gap-3">
              {[
                { icon: Phone,    label: "Nomor HP",   value: resident.phone },
                { icon: Home,     label: "Unit",        value: resident.block_unit },
                { icon: Users,    label: "Anggota KK",  value: `${resident.member_count} orang` },
                { icon: Calendar, label: "Terdaftar",   value: formatDate(resident.created_at) },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                  <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-3.5 h-3.5 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">{label}</p>
                    <p className="text-sm font-medium text-gray-800">{value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Documents */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Dokumen</p>
              <div className="flex gap-2">
                {resident.kk_file_url ? (
                  <a href={resident.kk_file_url} target="_blank" rel="noopener noreferrer"
                    className="flex-1 text-center py-2 rounded-lg border border-green-200 text-xs text-green-700 bg-green-50 hover:bg-green-100 transition-colors">
                    📄 Kartu Keluarga
                  </a>
                ) : (
                  <span className="flex-1 text-center py-2 rounded-lg border border-dashed border-gray-200 text-xs text-gray-400">
                    KK belum diupload
                  </span>
                )}
                {resident.ktp_file_url ? (
                  <a href={resident.ktp_file_url} target="_blank" rel="noopener noreferrer"
                    className="flex-1 text-center py-2 rounded-lg border border-green-200 text-xs text-green-700 bg-green-50 hover:bg-green-100 transition-colors">
                    🪪 KTP
                  </a>
                ) : (
                  <span className="flex-1 text-center py-2 rounded-lg border border-dashed border-gray-200 text-xs text-gray-400">
                    KTP belum diupload
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-2">
              {resident.status === "pending" && (
                <button onClick={() => setConfirmVerify(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-green-700 text-white text-sm font-medium hover:bg-green-600 transition-colors">
                  <CheckCircle2 className="w-4 h-4" /> Verifikasi Warga
                </button>
              )}
              {resident.status === "active" && (
                <button onClick={() => setConfirmMoveOut(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors">
                  <UserX className="w-4 h-4" /> Tandai Pindah
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {confirmVerify && (
        <ConfirmDialog
          title="Verifikasi Warga?"
          message={`Anda akan memverifikasi ${resident.full_name} sebagai warga aktif RT ini.`}
          loading={verifyMutation.isPending}
          onConfirm={() => verifyMutation.mutate(resident.id, { onSuccess: () => { setConfirmVerify(false); onClose(); } })}
          onCancel={() => setConfirmVerify(false)}
        />
      )}
      {confirmMoveOut && (
        <ConfirmDialog
          title="Tandai Pindah?"
          message={`${resident.full_name} akan ditandai sebagai warga yang sudah pindah.`}
          loading={moveOutMutation.isPending}
          onConfirm={() => moveOutMutation.mutate(resident.id, { onSuccess: () => { setConfirmMoveOut(false); onClose(); } })}
          onCancel={() => setConfirmMoveOut(false)}
        />
      )}
    </>
  );
}

// ── Main Page ──────────────────────────────────────────────────────
export default function WargaPage() {
  const [search,   setSearch]   = useState("");
  const [filter,   setFilter]   = useState<string>("all");
  const [selected, setSelected] = useState<Resident | null>(null);

  const { data: warga = [], isLoading } = useWargaList(filter === "all" ? undefined : filter);

  const filtered = warga.filter((w) =>
    !search ||
    w.full_name.toLowerCase().includes(search.toLowerCase()) ||
    w.phone.includes(search) ||
    w.block_unit?.toLowerCase().includes(search.toLowerCase())
  );

  const active  = warga.filter((w) => w.status === "active").length;
  const pending = warga.filter((w) => w.status === "pending").length;
  const total   = warga.length;

  const FILTERS = [
    { value: "all",      label: "Semua",    count: total   },
    { value: "active",   label: "Aktif",    count: active  },
    { value: "pending",  label: "Menunggu", count: pending },
    { value: "moved_out",label: "Pindah",   count: warga.filter((w) => w.status === "moved_out").length },
  ];

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total Warga"    value={total}   sub="KK terdaftar"    icon={Users}      variant="green" />
        <StatCard label="Warga Aktif"    value={active}  sub="Terverifikasi"   icon={UserCheck}  variant="green" />
        <StatCard label="Menunggu"       value={pending} sub="Perlu verifikasi" icon={Clock}      variant="amber" />
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        {/* Filter tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {FILTERS.map((f) => (
            <button key={f.value} onClick={() => setFilter(f.value)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                filter === f.value ? "bg-white text-green-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
              )}>
              {f.label}
              <span className={cn("ml-1.5 text-[10px]", filter === f.value ? "text-green-600" : "text-gray-400")}>
                ({f.count})
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, HP, unit..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500/30"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400 mx-auto" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400 font-medium">
              {warga.length === 0 ? "Belum ada warga terdaftar" : "Tidak ada warga sesuai filter"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {["Warga", "Kontak", "Unit", "Anggota KK", "Status", "Terdaftar", ""].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((w) => (
                  <tr key={w.id}
                    onClick={() => setSelected(w)}
                    className="hover:bg-gray-50 transition-colors cursor-pointer group">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={w.full_name} size="sm" />
                        <span className="text-sm font-medium text-gray-900">{w.full_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-500">{w.phone}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-500">{w.block_unit}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-500 text-center">{w.member_count}</td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={w.status} variant={getStatusVariant(w.status)} />
                    </td>
                    <td className="px-5 py-3.5 text-xs text-gray-400">{formatDate(w.created_at)}</td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs text-green-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        Detail →
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selected && <ResidentPanel resident={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
