"use client";
// app/beranda/keluarga/page.tsx
// Warga manages their KK (family members)
// Rules:
//   - Kepala KK must have no_kk filled first
//   - Anggota inherit Kepala's no_kk automatically
//   - Anggota have no login account
//   - Kepala can add/delete anggota

import apiClient from "@/lib/api/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, ChevronDown, Loader2, Plus,
  Trash2, UserPlus, Users, X,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AnggotaKK {
  id:                  string;
  full_name:           string;
  nik:                 string | null;
  no_kk:               string | null;
  tanggal_lahir:       string | null;
  tempat_lahir:        string | null;
  jenis_kelamin:       string | null;
  agama:               string | null;
  pekerjaan:           string | null;
  status_kawin:        string | null;
  hubungan_dengan_kk:  string | null;
  pendidikan_terakhir: string | null;
  kewarganegaraan:     string | null;
  phone:               string | null;
}

interface KeluargaResponse {
  no_kk:   string | null;
  kepala:  AnggotaKK | null;
  anggota: AnggotaKK[];
}

interface AddAnggotaPayload {
  full_name:           string;
  hubungan_dengan_kk:  string;
  phone?:              string;
  nik?:                string;
  tanggal_lahir?:      string;
  tempat_lahir?:       string;
  jenis_kelamin?:      string;
  agama?:              string;
  pekerjaan?:          string;
  status_kawin?:       string;
  status_tinggal?:     string;
  pendidikan_terakhir?:string;
  kewarganegaraan?:    string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const HUBUNGAN_OPTIONS = [
  "ISTRI","SUAMI","ANAK","ORANG TUA","MERTUA",
  "CUCU","MENANTU","SAUDARA","PEMBANTU","LAINNYA"
];
const JENIS_KELAMIN_OPTIONS = ["LAKI-LAKI","PEREMPUAN"];
const AGAMA_OPTIONS = ["ISLAM","KATHOLIK","KRISTEN","HINDU","BUDDHA","KONGHUCU"];
const PEKERJAAN_OPTIONS = [
  "PELAJAR/MAHASISWA","PNS","KARYAWAN SWASTA","KARYAWAN BUMN",
  "TNI","POLRI","NAKES","WIRASWASTA","MENGURUS RUMAH TANGGA",
  "GURU","OJEK","LAINNYA",
];
const STATUS_KAWIN_OPTIONS = ["BELUM KAWIN","KAWIN","CERAI HIDUP","CERAI MATI"];
const PENDIDIKAN_OPTIONS = [
  "TIDAK SEKOLAH","BELUM SEKOLAH","SD","SMP","SMA","SMK",
  "D3","S1","S2","S3","LAINNYA",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function SelectInput({
  label, value, onChange, options, placeholder, required,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: string[]; placeholder?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full pl-3 pr-8 py-2.5 rounded-xl border border-gray-200
            bg-gray-50 text-sm text-gray-900 appearance-none
            focus:outline-none focus:ring-2 focus:ring-blue-100
            focus:border-blue-400 transition-all"
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map(o => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2
          w-4 h-4 text-gray-400 pointer-events-none" />
      </div>
    </div>
  );
}

function TextInput({
  label, value, onChange, placeholder, required, type = "text", maxLength,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; required?: boolean; type?: string; maxLength?: number;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="w-full px-4 py-2.5 rounded-xl border border-gray-200
          bg-gray-50 text-sm text-gray-900 placeholder:text-gray-400
          focus:outline-none focus:ring-2 focus:ring-blue-100
          focus:border-blue-400 transition-all"
      />
    </div>
  );
}

// ── Add Anggota Modal ─────────────────────────────────────────────────────────

function AddAnggotaModal({
  noKk,
  onClose,
  onSuccess,
}: {
  noKk:      string;
  onClose:   () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState<AddAnggotaPayload>({
    full_name:          "",
    hubungan_dengan_kk: "",
    kewarganegaraan:    "WNI",
  });

  const set = (key: keyof AddAnggotaPayload) =>
    (val: string) => setForm(f => ({ ...f, [key]: val || undefined }));

  const mutation = useMutation({
    mutationFn: () => apiClient.post("/warga/anggota", form),
    onSuccess: (res) => {
      toast.success(`✅ ${res.data.message}`);
      onSuccess();
      onClose();
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail;
      toast.error(Array.isArray(detail) ? detail[0]?.msg : detail ?? "Gagal menambah anggota");
    },
  });

  const isValid = form.full_name.trim().length >= 2 && form.hubungan_dengan_kk;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center
      justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg
        max-h-[90vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center
          justify-between gap-3 flex-shrink-0">
          <div>
            <h3 className="font-bold text-gray-900">Tambah Anggota KK</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              No. KK: <span className="font-mono font-semibold">{noKk}</span>
            </p>
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600
              hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

          {/* Required fields */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-2">
            <p className="text-xs text-blue-700">
              <span className="font-bold">No. KK {noKk}</span> akan otomatis
              digunakan untuk anggota ini.
            </p>
          </div>

          <TextInput
            label="Nama Lengkap" required
            value={form.full_name}
            onChange={v => setForm(f => ({ ...f, full_name: v }))}
            placeholder="Nama sesuai KTP"
          />

          <SelectInput
            label="Hubungan dengan Kepala KK" required
            value={form.hubungan_dengan_kk ?? ""}
            onChange={set("hubungan_dengan_kk")}
            options={HUBUNGAN_OPTIONS}
            placeholder="Pilih hubungan"
          />

          {/* Optional fields */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-bold text-gray-500 uppercase
              tracking-wider mb-3">
              Data Tambahan (opsional)
            </p>
            <div className="space-y-3">
              <TextInput
                label="NIK (16 digit)"
                value={form.nik ?? ""}
                onChange={v => setForm(f => ({
                  ...f, nik: v.replace(/\D/g, "").slice(0, 16) || undefined
                }))}
                placeholder="3171xxxxxxxxxx"
                maxLength={16}
              />

              <div className="grid grid-cols-2 gap-3">
                <TextInput
                  label="Tempat Lahir"
                  value={form.tempat_lahir ?? ""}
                  onChange={set("tempat_lahir")}
                  placeholder="Jakarta"
                />
                <TextInput
                  label="Tanggal Lahir"
                  type="date"
                  value={form.tanggal_lahir ?? ""}
                  onChange={set("tanggal_lahir")}
                />
              </div>

              <SelectInput
                label="Jenis Kelamin"
                value={form.jenis_kelamin ?? ""}
                onChange={set("jenis_kelamin")}
                options={JENIS_KELAMIN_OPTIONS}
                placeholder="Pilih jenis kelamin"
              />

              <SelectInput
                label="Agama"
                value={form.agama ?? ""}
                onChange={set("agama")}
                options={AGAMA_OPTIONS}
                placeholder="Pilih agama"
              />

              <SelectInput
                label="Pendidikan Terakhir"
                value={form.pendidikan_terakhir ?? ""}
                onChange={set("pendidikan_terakhir")}
                options={PENDIDIKAN_OPTIONS}
                placeholder="Pilih pendidikan"
              />

              <SelectInput
                label="Pekerjaan"
                value={form.pekerjaan ?? ""}
                onChange={set("pekerjaan")}
                options={PEKERJAAN_OPTIONS}
                placeholder="Pilih pekerjaan"
              />

              <SelectInput
                label="Status Perkawinan"
                value={form.status_kawin ?? ""}
                onChange={set("status_kawin")}
                options={STATUS_KAWIN_OPTIONS}
                placeholder="Pilih status"
              />

              <TextInput
                label="No. HP"
                value={form.phone ?? ""}
                onChange={set("phone")}
                placeholder="08xxxxxxxxx"
                type="tel"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3
          flex-shrink-0">
          <button onClick={onClose} disabled={mutation.isPending}
            className="flex-1 py-2.5 rounded-xl border border-gray-200
              text-sm font-semibold text-gray-700 hover:bg-gray-50
              disabled:opacity-50 transition-colors">
            Batal
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!isValid || mutation.isPending}
            className="flex-1 flex items-center justify-center gap-2 py-2.5
              rounded-xl bg-blue-900 text-white text-sm font-semibold
              hover:bg-blue-800 disabled:opacity-50 transition-colors"
          >
            {mutation.isPending
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</>
              : <><UserPlus className="w-4 h-4" /> Tambah Anggota</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Anggota Card ──────────────────────────────────────────────────────────────

function AnggotaCard({
  anggota,
  onDelete,
  isDeleting,
}: {
  anggota:   AnggotaKK;
  onDelete:  (id: string) => void;
  isDeleting: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const initial = anggota.full_name.split(" ").slice(0, 2)
    .map(n => n[0]).join("").toUpperCase();
  const colors  = ["bg-purple-500","bg-pink-500","bg-teal-500",
                   "bg-orange-500","bg-indigo-500"];
  const color   = colors[anggota.full_name.charCodeAt(0) % colors.length];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm
      overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-4 py-4 text-left
          hover:bg-gray-50 transition-colors"
      >
        <div className={`w-10 h-10 rounded-xl ${color} flex items-center
          justify-center text-white text-sm font-bold flex-shrink-0`}>
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 truncate">
            {anggota.full_name}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {anggota.hubungan_dengan_kk ?? "—"}
            {anggota.pendidikan_terakhir && ` · ${anggota.pendidikan_terakhir}`}
            {anggota.jenis_kelamin && ` · ${anggota.jenis_kelamin}`}
          </p>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0
          transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100">
          <div className="mt-3 space-y-1.5">
            {[
              ["NIK",             anggota.nik],
              ["Tempat Lahir",    anggota.tempat_lahir],
              ["Tanggal Lahir",   anggota.tanggal_lahir
                ? new Date(anggota.tanggal_lahir).toLocaleDateString("id-ID", {
                    day: "numeric", month: "long", year: "numeric"
                  })
                : null],
              ["Jenis Kelamin",   anggota.jenis_kelamin],
              ["Agama",           anggota.agama],
              ["Pendidikan",      anggota.pendidikan_terakhir],
              ["Pekerjaan",       anggota.pekerjaan],
              ["Status Kawin",    anggota.status_kawin],
              ["Kewarganegaraan", anggota.kewarganegaraan],
              ["No. HP",          anggota.phone],
            ].filter(([_, v]) => v).map(([label, value]) => (
              <div key={label as string}
                className="flex items-start gap-2 text-xs">
                <span className="text-gray-400 w-28 flex-shrink-0">
                  {label}
                </span>
                <span className="text-gray-800 font-medium">{value}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => onDelete(anggota.id)}
            disabled={isDeleting}
            className="mt-4 flex items-center gap-1.5 text-xs text-red-500
              hover:text-red-700 disabled:opacity-50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Hapus dari daftar KK
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function KeluargaPage() {
  const { data: session, status } = useSession();
  const router      = useRouter();
  const queryClient = useQueryClient();

  const user     = session?.user as any;
  const rtGroupId = user?.rt_group_id;

  const [showAddModal, setShowAddModal] = useState(false);
  const [deletingId,   setDeletingId]   = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  const { data, isLoading, isError, refetch } = useQuery<KeluargaResponse>({
    queryKey: ["my-keluarga"],
    queryFn:  async () => {
      const { data } = await apiClient.get("/warga/my-keluarga");
      return data;
    },
    enabled:   !!rtGroupId,
    staleTime: 30_000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/warga/anggota/${id}`),
    onMutate:   (id) => setDeletingId(id),
    onSuccess:  (res) => {
      toast.success(res.data.message);
      queryClient.invalidateQueries({ queryKey: ["my-keluarga"] });
    },
    onError: () => toast.error("Gagal menghapus anggota"),
    onSettled: () => setDeletingId(null),
  });

  const noKk         = data?.no_kk;
  const anggotaList  = data?.anggota ?? [];
  const totalAnggota = anggotaList.length;

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-900 border-t-transparent
          rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <div className="bg-blue-900 text-white">
        <div className="max-w-lg mx-auto px-4 py-5">
          <div className="flex items-center gap-3">
            <Link href="/beranda"
              className="p-1.5 rounded-lg hover:bg-blue-800 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex-1">
              <h1 className="font-bold text-sm">Anggota Keluarga</h1>
              <p className="text-blue-300 text-xs">
                Data KK · {totalAnggota} anggota terdaftar
              </p>
            </div>
            {noKk && (
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-white/20
                  hover:bg-white/30 rounded-xl text-xs font-semibold
                  transition-colors"
              >
                <Plus className="w-4 h-4" />
                Tambah
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* No RT group */}
        {!rtGroupId && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl
            p-5 text-center">
            <div className="text-3xl mb-3">⏳</div>
            <p className="font-bold text-amber-800">Akun belum terverifikasi</p>
          </div>
        )}

        {rtGroupId && (
          <>
            {/* No KK warning */}
            {!noKk && !isLoading && (
              <div className="bg-amber-50 border border-amber-200
                rounded-2xl p-5">
                <div className="flex items-start gap-3">
                  <div className="text-2xl flex-shrink-0">⚠️</div>
                  <div>
                    <p className="font-bold text-amber-800 mb-1">
                      No. KK Belum Diisi
                    </p>
                    <p className="text-xs text-amber-700 mb-3 leading-relaxed">
                      Lengkapi No. KK di Profil Saya terlebih dahulu
                      sebelum menambah anggota keluarga.
                      No. KK digunakan untuk mengelompokkan semua
                      anggota keluarga Anda.
                    </p>
                    <Link href="/beranda/profil"
                      className="inline-flex items-center gap-1.5 px-4 py-2
                        bg-amber-600 text-white text-xs font-semibold
                        rounded-xl hover:bg-amber-700 transition-colors">
                      Lengkapi Profil →
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* KK header card */}
            {noKk && (
              <div className="bg-white rounded-2xl border border-gray-200
                shadow-sm p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-500
                      uppercase tracking-wider mb-1">
                      Kartu Keluarga
                    </p>
                    <p className="font-mono font-bold text-gray-900 text-lg">
                      {noKk}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      <span className="font-semibold text-blue-700">
                        {(totalAnggota + 1)}
                      </span> orang dalam KK ini
                      ({totalAnggota} anggota + Anda)
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex
                    items-center justify-center flex-shrink-0">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </div>
            )}

            {/* Loading */}
            {isLoading && (
              <div className="bg-white rounded-2xl border border-gray-200
                shadow-sm p-8 text-center">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600
                  mx-auto mb-2" />
                <p className="text-sm text-gray-400">Memuat data keluarga...</p>
              </div>
            )}

            {/* Anggota list */}
            {!isLoading && noKk && (
              <>
                {anggotaList.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-gray-200
                    shadow-sm p-8 text-center">
                    <div className="text-4xl mb-3">👨‍👩‍👧‍👦</div>
                    <p className="text-sm font-bold text-gray-700 mb-1">
                      Belum ada anggota keluarga
                    </p>
                    <p className="text-xs text-gray-400 mb-4">
                      Tambahkan istri, anak, atau anggota KK lainnya
                    </p>
                    <button
                      onClick={() => setShowAddModal(true)}
                      className="inline-flex items-center gap-2 px-4 py-2
                        bg-blue-900 text-white text-xs font-semibold
                        rounded-xl hover:bg-blue-800 transition-colors"
                    >
                      <UserPlus className="w-4 h-4" />
                      Tambah Anggota Pertama
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {anggotaList.map(anggota => (
                      <AnggotaCard
                        key={anggota.id}
                        anggota={anggota}
                        onDelete={(id) => deleteMutation.mutate(id)}
                        isDeleting={deletingId === anggota.id}
                      />
                    ))}
                    <button
                      onClick={() => setShowAddModal(true)}
                      className="w-full py-3 rounded-2xl border-2 border-dashed
                        border-gray-200 text-sm text-gray-400 font-semibold
                        hover:border-blue-300 hover:text-blue-500
                        transition-colors flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Tambah Anggota Lagi
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
              <p className="text-xs font-bold text-blue-900 mb-1">
                ℹ️ Tentang Fitur Ini
              </p>
              <div className="space-y-1 text-xs text-blue-700">
                <p>• Data anggota KK digunakan untuk laporan kependudukan RT</p>
                <p>• Kelurahan sering meminta data pendidikan per KK</p>
                <p>• Semua data aman dan hanya dilihat pengurus RT</p>
                <p>• Anggota yang ditambah tidak perlu membuat akun</p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && noKk && (
        <AddAnggotaModal
          noKk={noKk}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["my-keluarga"] });
          }}
        />
      )}
    </div>
  );
}
