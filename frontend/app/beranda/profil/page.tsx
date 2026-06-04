"use client";
// app/beranda/profil/page.tsx
// Warga profile edit — full Indonesian RT profile
// Mobile-first, matches beranda design (blue-900 header, max-w-lg)
//
// Updates:
//   users table    → full_name, phone
//   residents table → NIK, no_kk, tanggal_lahir, jenis_kelamin,
//                     agama, pekerjaan, status_kawin, status_tinggal,
//                     status_keluarga, kepala_keluarga, alamat_ktp

import apiClient from "@/lib/api/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, CheckCircle, ChevronDown,
  Loader2, Mail, Phone, Save, User,
} from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────

const AGAMA_OPTIONS = [
  "ISLAM","KATHOLIK","KRISTEN","HINDU","BUDDHA","KONGHUCU"
];
const JENIS_KELAMIN_OPTIONS = ["LAKI-LAKI","PEREMPUAN"];
const PEKERJAAN_OPTIONS = [
  "PELAJAR/MAHASISWA","PNS","KARYAWAN SWASTA","KARYAWAN BUMN",
  "TNI","POLRI","NAKES","WIRASWASTA","MENGURUS RUMAH TANGGA",
  "GURU","OJEK","LAINNYA",
];
const STATUS_KAWIN_OPTIONS = [
  "BELUM KAWIN","KAWIN","CERAI HIDUP","CERAI MATI"
];
const STATUS_TINGGAL_OPTIONS = [
  { value: "TETAP",     label: "Tetap (Pemilik/Hak Milik)" },
  { value: "KONTRAK",   label: "Kontrak"                    },
  { value: "KOST",      label: "Kost"                       },
  { value: "PINDAH",    label: "Sudah Pindah"               },
  { value: "MENINGGAL", label: "Meninggal Dunia"            },
  { value: "LAINNYA",   label: "Lainnya"                    },
];
const STATUS_KELUARGA_OPTIONS = [
  "SUAMI","ISTRI","ANAK","ORANG TUA","SAUDARA","LAINNYA","N/A"
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface UpdateProfilePayload {
  full_name:            string;
  phone:                string;
  nik?:                 string;
  no_kk?:               string;
  tanggal_lahir?:       string;
  tempat_lahir?:        string;
  jenis_kelamin?:       string;
  agama?:               string;
  pekerjaan?:           string;
  status_kawin?:        string;
  status_tinggal?:      string;
  status_keluarga?:     string;
  kepala_keluarga?:     boolean;
  alamat_ktp?:          string;
  pendidikan_terakhir?: string;
  kewarganegaraan?:     string;
  hubungan_dengan_kk?:  string;
}

interface ResidentProfile {
  nik?:                string;
  no_kk?:              string;
  tanggal_lahir?:      string;
  tempat_lahir?:       string;
  jenis_kelamin?:      string;
  agama?:              string;
  pekerjaan?:          string;
  status_kawin?:       string;
  status_tinggal?:     string;
  status_keluarga?:    string;
  kepala_keluarga?:    boolean;
  alamat_ktp?:         string;
  pendidikan_terakhir?:string;
  kewarganegaraan?:    string;
  hubungan_dengan_kk?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPhoneDisplay(phone: string): string {
  if (phone?.startsWith("62")) return "0" + phone.slice(2);
  return phone ?? "";
}

function formatPhoneForApi(phone: string): string {
  const clean = phone.replace(/[-\s]/g, "");
  if (clean.startsWith("0")) return "62" + clean.slice(1);
  if (clean.startsWith("+")) return clean.slice(1);
  return clean;
}

// ── SelectField component ─────────────────────────────────────────────────────

function SelectField({
  label, value, onChange, options, placeholder,
}: {
  label:       string;
  value:       string;
  onChange:    (v: string) => void;
  options:     { value: string; label: string }[] | string[];
  placeholder?: string;
}) {
  const normalised = (options as any[]).map(o =>
    typeof o === "string" ? { value: o, label: o } : o
  );
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full pl-3 pr-8 py-3 rounded-xl border border-gray-200
            bg-gray-50 text-sm text-gray-900 appearance-none
            focus:outline-none focus:ring-2 focus:ring-blue-100
            focus:border-blue-400 transition-all"
        >
          {placeholder && <option value="">{placeholder}</option>}
          {normalised.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2
          w-4 h-4 text-gray-400 pointer-events-none" />
      </div>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function Section({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="px-5 py-3 bg-gray-50 border-y border-gray-100">
      <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">
        {title}
      </p>
      {subtitle && (
        <p className="text-[10px] text-gray-400 mt-0.5">{subtitle}</p>
      )}
    </div>
  );
}

const PENDIDIKAN_OPTIONS = [
  "TIDAK SEKOLAH","BELUM SEKOLAH","SD","SMP","SMA","SMK","D3","S1","S2","S3","LAINNYA"
];
const KEWARGANEGARAAN_OPTIONS = ["WNI","WNA"];
const HUBUNGAN_KK_OPTIONS = [
  "KEPALA KELUARGA","SUAMI","ISTRI","ANAK","MENANTU",
  "CUCU","ORANG TUA","MERTUA","SAUDARA","PEMBANTU","LAINNYA"
];

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ProfilPage() {
  const { data: session, status, update } = useSession();
  const router      = useRouter();
  const queryClient = useQueryClient();

  const user      = session?.user as any;
  const fullName  = user?.full_name ?? user?.name ?? "";
  const phone     = user?.phone ?? "";
  const email     = user?.email ?? "";
  const userRole  = user?.role ?? "";
  const rtGroupId = user?.rt_group_id;

  // Form state — core
  const [formName,  setFormName]  = useState("");
  const [formPhone, setFormPhone] = useState("");

  // Form state — rich profile
  const [nik,             setNik]             = useState("");
  const [noKk,            setNoKk]            = useState("");
  const [tanggalLahir,    setTanggalLahir]    = useState("");
  const [tempatLahir,     setTempatLahir]     = useState("");
  const [jenisKelamin,    setJenisKelamin]    = useState("");
  const [agama,           setAgama]           = useState("");
  const [pekerjaan,       setPekerjaan]       = useState("");
  const [statusKawin,     setStatusKawin]     = useState("");
  const [statusTinggal,   setStatusTinggal]   = useState("TETAP");
  const [statusKeluarga,  setStatusKeluarga]  = useState("");
  const [kepalaKeluarga,  setKepalaKeluarga]  = useState(false);
  const [pendidikan,      setPendidikan]      = useState("");
  const [kewarganegaraan, setKewarganegaraan] = useState("WNI");
  const [hubunganKK,      setHubunganKK]      = useState("");
  const [alamatKtp,       setAlamatKtp]       = useState("");

  const [isDirty, setIsDirty] = useState(false);

  // Fetch resident profile for rich fields
  const { data: resident } = useQuery<ResidentProfile>({
    queryKey: ["my-resident-profile", rtGroupId],
    queryFn:  async () => {
      if (!rtGroupId) return {};
      const { data } = await apiClient.get(`/warga/my-profile`);
      return data;
    },
    enabled: !!rtGroupId,
    staleTime: 60_000,
  });

  // Initialise form
  useEffect(() => {
    if (fullName) setFormName(fullName);
    if (phone)    setFormPhone(formatPhoneDisplay(phone));
  }, [fullName, phone]);

  useEffect(() => {
    if (!resident) return;
    if (resident.nik)             setNik(resident.nik);
    if (resident.no_kk)           setNoKk(resident.no_kk);
    if (resident.tanggal_lahir)   setTanggalLahir(resident.tanggal_lahir);
    if (resident.tempat_lahir)    setTempatLahir(resident.tempat_lahir);
    if (resident.jenis_kelamin)   setJenisKelamin(resident.jenis_kelamin);
    if (resident.agama)           setAgama(resident.agama);
    if (resident.pekerjaan)       setPekerjaan(resident.pekerjaan);
    if (resident.status_kawin)    setStatusKawin(resident.status_kawin);
    if (resident.status_tinggal)  setStatusTinggal(resident.status_tinggal);
    if (resident.status_keluarga) setStatusKeluarga(resident.status_keluarga);
    if (resident.kepala_keluarga !== undefined) setKepalaKeluarga(resident.kepala_keluarga ?? false);
    if (resident.pendidikan_terakhir) setPendidikan(resident.pendidikan_terakhir);
    if (resident.kewarganegaraan)     setKewarganegaraan(resident.kewarganegaraan);
    if (resident.hubungan_dengan_kk)  setHubunganKK(resident.hubungan_dengan_kk);
    if (resident.alamat_ktp)      setAlamatKtp(resident.alamat_ktp);
  }, [resident]);

  // Dirty tracking
  useEffect(() => {
    setIsDirty(
      formName.trim()          !== fullName               ||
      formatPhoneForApi(formPhone) !== phone
    );
  }, [formName, formPhone, fullName, phone]);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload: UpdateProfilePayload = {
        full_name:       formName.trim(),
        phone:           formatPhoneForApi(formPhone),
        nik:             nik       || undefined,
        no_kk:           noKk      || undefined,
        tanggal_lahir:   tanggalLahir || undefined,
        tempat_lahir:    tempatLahir  || undefined,
        jenis_kelamin:   jenisKelamin || undefined,
        agama:           agama        || undefined,
        pekerjaan:       pekerjaan    || undefined,
        status_kawin:    statusKawin  || undefined,
        status_tinggal:  statusTinggal || undefined,
        status_keluarga: statusKeluarga || undefined,
        kepala_keluarga:     kepalaKeluarga,
        pendidikan_terakhir: pendidikan    || undefined,
        kewarganegaraan:     kewarganegaraan || undefined,
        hubungan_dengan_kk:  hubunganKK    || undefined,
        alamat_ktp:      alamatKtp || undefined,
      };
      return apiClient.patch("/users/me/profile", payload);
    },
    onSuccess: async (res) => {
      toast.success("✅ Profil berhasil diperbarui!");
      await update({ full_name: res.data.full_name, phone: res.data.phone });
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: ["my-resident-profile"] });
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail;
      if (Array.isArray(detail)) {
        toast.error(detail[0]?.msg ?? "Validasi gagal");
      } else {
        toast.error(detail ?? "Gagal memperbarui profil");
      }
    },
  });

  const roleLabel: Record<string, string> = {
    warga:      "Warga RT",
    ketua_rt:   "Ketua RT",
    superadmin: "Superadmin RTMudah",
  };

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
            <div>
              <h1 className="font-bold text-sm">Profil Saya</h1>
              <p className="text-blue-300 text-xs">Update data diri Anda</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto py-6 space-y-4">

        {/* Avatar card */}
        <div className="mx-4 bg-white rounded-2xl border border-gray-200
          shadow-sm p-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-900 flex items-center
              justify-center flex-shrink-0">
              <span className="text-white text-xl font-bold">
                {formName.split(" ").slice(0, 2).map((n: string) => n[0])
                  .join("").toUpperCase() || "?"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 truncate">
                {formName || "—"}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{email}</p>
              <span className="inline-flex items-center mt-1.5 px-2.5 py-0.5
                rounded-full text-[10px] font-semibold
                bg-blue-100 text-blue-800">
                {roleLabel[userRole] ?? userRole}
              </span>
            </div>
          </div>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-2xl border border-gray-200
          shadow-sm overflow-hidden mx-4">

          {/* ── Section 1: Akun ──────────────────────────────────── */}
          <Section title="Akun" subtitle="Nama dan nomor WhatsApp" />
          <div className="px-5 py-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Nama Lengkap <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2
                  w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="Nama sesuai KTP"
                  maxLength={100}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200
                    bg-gray-50 text-sm text-gray-900 placeholder:text-gray-400
                    focus:outline-none focus:ring-2 focus:ring-blue-100
                    focus:border-blue-400 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Nomor HP (WhatsApp) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2
                  w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="tel"
                  value={formPhone}
                  onChange={e => setFormPhone(e.target.value)}
                  placeholder="08123456789"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200
                    bg-gray-50 text-sm text-gray-900 placeholder:text-gray-400
                    focus:outline-none focus:ring-2 focus:ring-blue-100
                    focus:border-blue-400 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Email
                <span className="ml-2 text-[10px] font-normal text-gray-400">
                  (tidak dapat diubah)
                </span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2
                  w-4 h-4 text-gray-300 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  readOnly
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-100
                    bg-gray-100 text-sm text-gray-400 cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {/* ── Section 2: Identitas KTP ─────────────────────────── */}
          <Section title="Identitas KTP"
            subtitle="Data sesuai Kartu Tanda Penduduk" />
          <div className="px-5 py-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                NIK (16 digit)
              </label>
              <input
                type="text"
                value={nik}
                onChange={e => setNik(e.target.value.replace(/\D/g, "").slice(0, 16))}
                placeholder="3171xxxxxxxxxx"
                maxLength={16}
                className="w-full px-4 py-3 rounded-xl border border-gray-200
                  bg-gray-50 text-sm font-mono text-gray-900
                  placeholder:text-gray-400 focus:outline-none focus:ring-2
                  focus:ring-blue-100 focus:border-blue-400 transition-all"
              />
              <p className="text-[10px] text-gray-400 mt-1">
                {nik.length}/16 digit
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Nomor KK (16 digit)
              </label>
              <input
                type="text"
                value={noKk}
                onChange={e => setNoKk(e.target.value.replace(/\D/g, "").slice(0, 16))}
                placeholder="3171xxxxxxxxxx"
                maxLength={16}
                className="w-full px-4 py-3 rounded-xl border border-gray-200
                  bg-gray-50 text-sm font-mono text-gray-900
                  placeholder:text-gray-400 focus:outline-none focus:ring-2
                  focus:ring-blue-100 focus:border-blue-400 transition-all"
              />
              <p className="text-[10px] text-gray-400 mt-1">
                {noKk.length}/16 digit
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Tanggal Lahir
                </label>
                <input
                  type="date"
                  value={tanggalLahir}
                  onChange={e => setTanggalLahir(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                  className="w-full px-3 py-3 rounded-xl border border-gray-200
                    bg-gray-50 text-sm text-gray-900
                    focus:outline-none focus:ring-2 focus:ring-blue-100
                    focus:border-blue-400 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Tempat Lahir
                </label>
                <input
                  type="text"
                  value={tempatLahir}
                  onChange={e => setTempatLahir(e.target.value)}
                  placeholder="Jakarta"
                  className="w-full px-3 py-3 rounded-xl border border-gray-200
                    bg-gray-50 text-sm text-gray-900 placeholder:text-gray-400
                    focus:outline-none focus:ring-2 focus:ring-blue-100
                    focus:border-blue-400 transition-all"
                />
              </div>
            </div>

            <SelectField
              label="Jenis Kelamin"
              value={jenisKelamin}
              onChange={setJenisKelamin}
              options={JENIS_KELAMIN_OPTIONS}
              placeholder="Pilih jenis kelamin"
            />

            <SelectField
              label="Agama"
              value={agama}
              onChange={setAgama}
              options={AGAMA_OPTIONS}
              placeholder="Pilih agama"
            />

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Alamat sesuai KTP
              </label>
              <textarea
                value={alamatKtp}
                onChange={e => setAlamatKtp(e.target.value)}
                placeholder="Jl. Contoh No. 1, RT 001/RW 001..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-gray-200
                  bg-gray-50 text-sm text-gray-900 placeholder:text-gray-400
                  resize-none focus:outline-none focus:ring-2 focus:ring-blue-100
                  focus:border-blue-400 transition-all"
              />
            </div>
          </div>

          {/* ── Section 3: Data Sosial ───────────────────────────── */}
          <Section title="Data Sosial" subtitle="Pekerjaan dan status perkawinan" />
          <div className="px-5 py-4 space-y-4">
            <SelectField
              label="Pekerjaan"
              value={pekerjaan}
              onChange={setPekerjaan}
              options={PEKERJAAN_OPTIONS}
              placeholder="Pilih pekerjaan"
            />
            <SelectField
              label="Status Perkawinan"
              value={statusKawin}
              onChange={setStatusKawin}
              options={STATUS_KAWIN_OPTIONS}
              placeholder="Pilih status perkawinan"
            />
          </div>

          {/* ── Section 4: Data RT ───────────────────────────────── */}
          <Section title="Data RT"
            subtitle="Status tinggal dan hubungan keluarga" />
          <div className="px-5 py-4 space-y-4">
            <SelectField
              label="Status Tinggal"
              value={statusTinggal}
              onChange={setStatusTinggal}
              options={STATUS_TINGGAL_OPTIONS}
            />
            <SelectField
              label="Status dalam Keluarga"
              value={statusKeluarga}
              onChange={setStatusKeluarga}
              options={STATUS_KELUARGA_OPTIONS}
              placeholder="Pilih status keluarga"
            />

            {/* Kepala Keluarga toggle */}
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-semibold text-gray-700">
                  Kepala Keluarga
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Bertanggung jawab atas tagihan iuran KK
                </p>
              </div>
              <button
                type="button"
                onClick={() => setKepalaKeluarga(k => !k)}
                className={`w-12 h-6 rounded-full transition-colors relative
                  flex-shrink-0 ${
                    kepalaKeluarga ? "bg-blue-600" : "bg-gray-200"
                  }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow-sm
                  absolute top-0.5 transition-transform ${
                    kepalaKeluarga ? "translate-x-6" : "translate-x-0.5"
                  }`} />
              </button>
            </div>
          </div>

          {/* Pendidikan + Kewarganegaraan + Hubungan KK */}
          <SelectField
            label="Pendidikan Terakhir"
            value={pendidikan}
            onChange={setPendidikan}
            options={PENDIDIKAN_OPTIONS}
            placeholder="Pilih pendidikan terakhir"
          />
          <SelectField
            label="Kewarganegaraan"
            value={kewarganegaraan}
            onChange={setKewarganegaraan}
            options={KEWARGANEGARAAN_OPTIONS}
          />
          <SelectField
            label="Hubungan dengan Kepala KK"
            value={hubunganKK}
            onChange={setHubunganKK}
            options={HUBUNGAN_KK_OPTIONS}
            placeholder="Pilih hubungan dengan KK"
          />

          {/* Save button */}
          <div className="px-5 pb-5 pt-2">
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !formName.trim() || !formPhone.trim()}
              className={`w-full flex items-center justify-center gap-2 py-3
                rounded-xl text-sm font-semibold transition-all ${
                  !mutation.isPending && formName.trim() && formPhone.trim()
                    ? "bg-blue-900 text-white hover:bg-blue-800 active:scale-[0.98]"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                }`}
            >
              {mutation.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</>
                : mutation.isSuccess
                ? <><CheckCircle className="w-4 h-4" /> Tersimpan</>
                : <><Save className="w-4 h-4" /> Simpan Perubahan</>
              }
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="mx-4 bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="text-xs font-bold text-amber-800 mb-1">
            ℹ️ Kenapa data ini diperlukan?
          </p>
          <div className="space-y-1 text-xs text-amber-700">
            <p>• NIK & No. KK diperlukan untuk surat keterangan RT</p>
            <p>• Data kependudukan membantu Ketua RT mengelola warga</p>
            <p>• Semua data aman dan hanya dapat dilihat pengurus RT</p>
          </div>
        </div>

        <Link href="/beranda"
          className="block text-center text-sm text-gray-400
            hover:text-gray-600 py-2 transition-colors">
          ← Kembali ke Beranda
        </Link>

      </div>
    </div>
  );
}
