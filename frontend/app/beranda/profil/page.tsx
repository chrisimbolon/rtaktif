"use client";
// app/beranda/profil/page.tsx
// UPDATED — Path B: ALL profile changes go through approval flow.
//
// Replaces the instant PATCH /users/me/profile mutation with
// POST /warga/me/change-requests. Adds a "Riwayat Permintaan" section
// showing pending/approved/rejected requests, and disables fields that
// already have a pending request.
//
// Layout, sections, SelectField, constants — ALL UNCHANGED from original.
// Only the data flow (fetch + submit) and the bottom info section change.

import apiClient from "@/lib/api/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, CheckCircle, ChevronDown, Clock,
  Loader2, Mail, Phone, Save, User, XCircle,
} from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

// ── Constants (unchanged) ───────────────────────────────────────────────────

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
const PENDIDIKAN_OPTIONS = [
  "TIDAK SEKOLAH","BELUM SEKOLAH","SD","SMP","SMA","SMK","D3","S1","S2","S3","LAINNYA"
];
const KEWARGANEGARAAN_OPTIONS = ["WNI","WNA"];
const HUBUNGAN_KK_OPTIONS = [
  "KEPALA KELUARGA","SUAMI","ISTRI","ANAK","MENANTU",
  "CUCU","ORANG TUA","MERTUA","SAUDARA","PEMBANTU","LAINNYA"
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface ResidentProfile {
  full_name?:          string;
  phone?:              string;
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

interface ChangeRequestItem {
  id:                string;
  field_name:        string;
  field_label:       string;
  old_value:         string | null;
  new_value:         string | null;
  status:            "pending" | "approved" | "rejected";
  reviewed_by_name:  string | null;
  reviewed_at:       string | null;
  rejection_reason:  string | null;
  created_at:        string;
}

// Fields that map to UserModel (not ResidentModel) but are still submitted
// through the same change-request payload — backend handles the dual-write.
const SUBMITTABLE_FIELDS = [
  "full_name", "phone", "nik", "no_kk", "tanggal_lahir", "tempat_lahir",
  "jenis_kelamin", "agama", "pekerjaan", "status_kawin", "status_tinggal",
  "alamat_ktp", "pendidikan_terakhir",
] as const;

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

function formatDateShort(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric", month: "short", year: "numeric",
  }).format(new Date(iso));
}

// ── SelectField component (unchanged) ──────────────────────────────────────────

function SelectField({
  label, value, onChange, options, placeholder, disabled,
}: {
  label:       string;
  value:       string;
  onChange:    (v: string) => void;
  options:     { value: string; label: string }[] | string[];
  placeholder?: string;
  disabled?:   boolean;
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
          disabled={disabled}
          className={`w-full pl-3 pr-8 py-3 rounded-xl border text-sm appearance-none
            focus:outline-none focus:ring-2 focus:ring-blue-100
            focus:border-blue-400 transition-all ${
              disabled
                ? "border-gray-100 bg-gray-100 text-gray-400 cursor-not-allowed"
                : "border-gray-200 bg-gray-50 text-gray-900"
            }`}
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

// ── Section header (unchanged) ──────────────────────────────────────────────────

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

// ── Pending badge — shown next to a field with a pending request ─────────────

function PendingBadge({ newValue }: { newValue: string | null }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full
      text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">
      <Clock className="w-2.5 h-2.5" />
      Menunggu: {newValue || "—"}
    </span>
  );
}

// ── Riwayat item ─────────────────────────────────────────────────────────────

function RiwayatItem({ item }: { item: ChangeRequestItem }) {
  const statusCfg: Record<string, { label: string; cls: string; icon: any }> = {
    pending:  { label: "Menunggu",  cls: "bg-amber-50 text-amber-700 border-amber-200",  icon: Clock },
    approved: { label: "Disetujui", cls: "bg-green-50 text-green-700 border-green-200",  icon: CheckCircle },
    rejected: { label: "Ditolak",   cls: "bg-red-50 text-red-700 border-red-200",        icon: XCircle },
  };
  const cfg = statusCfg[item.status];
  const Icon = cfg.icon;

  return (
    <div className="px-4 py-3 border-b border-gray-100 last:border-b-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900">{item.field_label}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {item.old_value || "—"} → <span className="font-medium text-gray-700">{item.new_value || "—"}</span>
          </p>
          {item.status === "rejected" && item.rejection_reason && (
            <p className="text-xs text-red-600 mt-1">
              Alasan: {item.rejection_reason}
            </p>
          )}
          <p className="text-[10px] text-gray-400 mt-1">
            {formatDateShort(item.created_at)}
            {item.reviewed_by_name && ` · oleh ${item.reviewed_by_name}`}
          </p>
        </div>
        <span className={`flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5
          rounded-full text-[10px] font-semibold border ${cfg.cls}`}>
          <Icon className="w-2.5 h-2.5" />
          {cfg.label}
        </span>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ProfilPage() {
  const { data: session, status } = useSession();
  const router      = useRouter();
  const queryClient = useQueryClient();

  const user      = session?.user as any;
  const email     = user?.email ?? "";
  const userRole  = user?.role ?? "";
  const rtGroupId = user?.rt_group_id;

  // Form state
  const [formName,  setFormName]  = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [nik,             setNik]             = useState("");
  const [noKk,            setNoKk]            = useState("");
  const [tanggalLahir,    setTanggalLahir]    = useState("");
  const [tempatLahir,     setTempatLahir]     = useState("");
  const [jenisKelamin,    setJenisKelamin]    = useState("");
  const [agama,           setAgama]           = useState("");
  const [pekerjaan,       setPekerjaan]       = useState("");
  const [statusKawin,     setStatusKawin]     = useState("");
  const [statusTinggal,   setStatusTinggal]   = useState("TETAP");
  const [pendidikan,      setPendidikan]      = useState("");
  const [alamatKtp,       setAlamatKtp]       = useState("");

  const [isDirty, setIsDirty] = useState(false);

  // ── Fetch resident profile (current saved values) ─────────────────────────
  const { data: resident } = useQuery<ResidentProfile>({
    queryKey: ["my-resident-profile", rtGroupId],
    queryFn:  async () => {
      const { data } = await apiClient.get("/warga/my-profile");
      return data;
    },
    enabled: !!rtGroupId,
    staleTime: 60_000,
  });

  // ── Fetch own change request history ───────────────────────────────────────
  const { data: requests = [] } = useQuery<ChangeRequestItem[]>({
    queryKey: ["my-change-requests"],
    queryFn:  async () => {
      const { data } = await apiClient.get("/warga/me/change-requests");
      return data;
    },
    enabled: !!rtGroupId,
    staleTime: 30_000,
  });

  // Map of field_name → pending request (for badges + disabling inputs)
  const pendingByField = new Map<string, ChangeRequestItem>(
    requests.filter(r => r.status === "pending").map(r => [r.field_name, r])
  );

  // ── Initialise form from session + resident profile ───────────────────────
  useEffect(() => {
    if (user?.full_name || user?.name) setFormName(user.full_name ?? user.name ?? "");
    if (user?.phone)    setFormPhone(formatPhoneDisplay(user.phone));
  }, [user]);

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
    if (resident.pendidikan_terakhir) setPendidikan(resident.pendidikan_terakhir);
    if (resident.alamat_ktp)      setAlamatKtp(resident.alamat_ktp);
  }, [resident]);

  // ── Dirty tracking — compare against resident + session current values ────
  useEffect(() => {
    const current: Record<string, string> = {
      full_name:           user?.full_name ?? user?.name ?? "",
      phone:               formatPhoneDisplay(user?.phone ?? ""),
      nik:                 resident?.nik ?? "",
      no_kk:               resident?.no_kk ?? "",
      tanggal_lahir:       resident?.tanggal_lahir ?? "",
      tempat_lahir:        resident?.tempat_lahir ?? "",
      jenis_kelamin:       resident?.jenis_kelamin ?? "",
      agama:               resident?.agama ?? "",
      pekerjaan:           resident?.pekerjaan ?? "",
      status_kawin:        resident?.status_kawin ?? "",
      status_tinggal:      resident?.status_tinggal ?? "TETAP",
      pendidikan_terakhir: resident?.pendidikan_terakhir ?? "",
      alamat_ktp:          resident?.alamat_ktp ?? "",
    };
    const form: Record<string, string> = {
      full_name: formName, phone: formPhone, nik, no_kk: noKk,
      tanggal_lahir: tanggalLahir, tempat_lahir: tempatLahir,
      jenis_kelamin: jenisKelamin, agama, pekerjaan,
      status_kawin: statusKawin, status_tinggal: statusTinggal,
      pendidikan_terakhir: pendidikan, alamat_ktp: alamatKtp,
    };
    const changed = Object.keys(current).some(k => current[k] !== form[k]);
    console.log("dirty check:", { current, form, changed });

    setIsDirty(changed);
  }, [
    formName, formPhone, nik, noKk, tanggalLahir, tempatLahir, jenisKelamin,
    agama, pekerjaan, statusKawin, statusTinggal, pendidikan, alamatKtp,
    user, resident,
  ]);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  // ── Submit — POST /warga/me/change-requests ────────────────────────────────
  const mutation = useMutation({
    mutationFn: () => {
      const current: Record<string, string> = {
        full_name:           user?.full_name ?? user?.name ?? "",
        phone:               formatPhoneDisplay(user?.phone ?? ""),
        nik:                 resident?.nik ?? "",
        no_kk:               resident?.no_kk ?? "",
        tanggal_lahir:       resident?.tanggal_lahir ?? "",
        tempat_lahir:        resident?.tempat_lahir ?? "",
        jenis_kelamin:       resident?.jenis_kelamin ?? "",
        agama:               resident?.agama ?? "",
        pekerjaan:           resident?.pekerjaan ?? "",
        status_kawin:        resident?.status_kawin ?? "",
        status_tinggal:      resident?.status_tinggal ?? "TETAP",
        pendidikan_terakhir: resident?.pendidikan_terakhir ?? "",
        alamat_ktp:          resident?.alamat_ktp ?? "",
      };
      const form: Record<string, string | boolean> = {
        full_name: formName.trim(),
        phone: formatPhoneForApi(formPhone),
        nik, no_kk: noKk,
        tanggal_lahir: tanggalLahir, tempat_lahir: tempatLahir,
        jenis_kelamin: jenisKelamin, agama, pekerjaan,
        status_kawin: statusKawin, status_tinggal: statusTinggal,
        pendidikan_terakhir: pendidikan, alamat_ktp: alamatKtp,
      };

      // Build payload — only fields that actually changed AND don't already
      // have a pending request (backend also guards this, but skip client-side
      // to avoid a confusing "0 created" response when nothing new changed).
      const payload: Record<string, any> = {};
      for (const field of SUBMITTABLE_FIELDS) {
        if (pendingByField.has(field)) continue;

        let currentVal = current[field] ?? "";
        let formVal    = form[field] ?? "";

        if (field === "phone") {
          currentVal = formatPhoneForApi(currentVal as string);
          formVal    = formatPhoneForApi(formVal as string);
        }

        if (currentVal !== formVal) {
          payload[field] = formVal === "" ? null : formVal;
        }
      }

      if (Object.keys(payload).length === 0) {
        throw new Error("NO_CHANGES");
      }

      return apiClient.post("/warga/me/change-requests", payload);
    },
    onSuccess: (res) => {
      const data = res.data;
      if (data.created_count === 0) {
        toast.info(data.message);
      } else {
        toast.success(`✅ ${data.message}`);
      }
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: ["my-change-requests"] });
    },
    onError: (err: any) => {
      if (err?.message === "NO_CHANGES") {
        toast.info("Tidak ada perubahan untuk diajukan");
        return;
      }
      const detail = err?.response?.data?.detail;
      if (Array.isArray(detail)) {
        toast.error(detail[0]?.msg ?? "Validasi gagal");
      } else {
        toast.error(detail ?? "Gagal mengajukan perubahan");
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

  const fieldPending = (field: string) => pendingByField.get(field);

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
              <p className="text-blue-300 text-xs">Ajukan perubahan data diri</p>
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

        {/* ── Riwayat Permintaan — only show if there's history ──────────── */}
        {requests.length > 0 && (
          <div className="mx-4 bg-white rounded-2xl border border-gray-200
            shadow-sm overflow-hidden">
            <Section title="Riwayat Permintaan"
              subtitle="Status pengajuan perubahan data Anda" />
            <div>
              {requests.slice(0, 10).map(item => (
                <RiwayatItem key={item.id} item={item} />
              ))}
            </div>
          </div>
        )}

        {/* Form card */}
        <div className="bg-white rounded-2xl border border-gray-200
          shadow-sm overflow-hidden mx-4">

          {/* ── Section 1: Akun ──────────────────────────────────── */}
          <Section title="Akun" subtitle="Nama dan nomor WhatsApp" />
          <div className="px-5 py-4 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-gray-700">
                  Nama Lengkap <span className="text-red-500">*</span>
                </label>
                {fieldPending("full_name") && (
                  <PendingBadge newValue={fieldPending("full_name")!.new_value} />
                )}
              </div>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2
                  w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="Nama sesuai KTP"
                  maxLength={100}
                  disabled={!!fieldPending("full_name")}
                  className={`w-full pl-10 pr-4 py-3 rounded-xl border text-sm
                    placeholder:text-gray-400 focus:outline-none focus:ring-2
                    focus:ring-blue-100 focus:border-blue-400 transition-all ${
                      fieldPending("full_name")
                        ? "border-gray-100 bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "border-gray-200 bg-gray-50 text-gray-900"
                    }`}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-gray-700">
                  Nomor HP (WhatsApp) <span className="text-red-500">*</span>
                </label>
                {fieldPending("phone") && (
                  <PendingBadge newValue={fieldPending("phone")!.new_value} />
                )}
              </div>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2
                  w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="tel"
                  value={formPhone}
                  onChange={e => setFormPhone(e.target.value)}
                  placeholder="08123456789"
                  disabled={!!fieldPending("phone")}
                  className={`w-full pl-10 pr-4 py-3 rounded-xl border text-sm
                    placeholder:text-gray-400 focus:outline-none focus:ring-2
                    focus:ring-blue-100 focus:border-blue-400 transition-all ${
                      fieldPending("phone")
                        ? "border-gray-100 bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "border-gray-200 bg-gray-50 text-gray-900"
                    }`}
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
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-gray-700">
                  NIK (16 digit)
                </label>
                {fieldPending("nik") && (
                  <PendingBadge newValue={fieldPending("nik")!.new_value} />
                )}
              </div>
              <input
                type="text"
                value={nik}
                onChange={e => setNik(e.target.value.replace(/\D/g, "").slice(0, 16))}
                placeholder="3171xxxxxxxxxx"
                maxLength={16}
                disabled={!!fieldPending("nik")}
                className={`w-full px-4 py-3 rounded-xl border text-sm font-mono
                  placeholder:text-gray-400 focus:outline-none focus:ring-2
                  focus:ring-blue-100 focus:border-blue-400 transition-all ${
                    fieldPending("nik")
                      ? "border-gray-100 bg-gray-100 text-gray-400 cursor-not-allowed"
                      : "border-gray-200 bg-gray-50 text-gray-900"
                  }`}
              />
              <p className="text-[10px] text-gray-400 mt-1">
                {nik.length}/16 digit
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-gray-700">
                  Nomor KK (16 digit)
                </label>
                {fieldPending("no_kk") && (
                  <PendingBadge newValue={fieldPending("no_kk")!.new_value} />
                )}
              </div>
              <input
                type="text"
                value={noKk}
                onChange={e => setNoKk(e.target.value.replace(/\D/g, "").slice(0, 16))}
                placeholder="3171xxxxxxxxxx"
                maxLength={16}
                disabled={!!fieldPending("no_kk")}
                className={`w-full px-4 py-3 rounded-xl border text-sm font-mono
                  placeholder:text-gray-400 focus:outline-none focus:ring-2
                  focus:ring-blue-100 focus:border-blue-400 transition-all ${
                    fieldPending("no_kk")
                      ? "border-gray-100 bg-gray-100 text-gray-400 cursor-not-allowed"
                      : "border-gray-200 bg-gray-50 text-gray-900"
                  }`}
              />
              <p className="text-[10px] text-gray-400 mt-1">
                {noKk.length}/16 digit
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-gray-700">
                    Tanggal Lahir
                  </label>
                </div>
                {fieldPending("tanggal_lahir") && (
                  <div className="mb-1.5"><PendingBadge newValue={fieldPending("tanggal_lahir")!.new_value} /></div>
                )}
                <input
                  type="date"
                  value={tanggalLahir}
                  onChange={e => setTanggalLahir(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                  disabled={!!fieldPending("tanggal_lahir")}
                  className={`w-full px-3 py-3 rounded-xl border text-sm
                    focus:outline-none focus:ring-2 focus:ring-blue-100
                    focus:border-blue-400 transition-all ${
                      fieldPending("tanggal_lahir")
                        ? "border-gray-100 bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "border-gray-200 bg-gray-50 text-gray-900"
                    }`}
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-gray-700">
                    Tempat Lahir
                  </label>
                </div>
                {fieldPending("tempat_lahir") && (
                  <div className="mb-1.5"><PendingBadge newValue={fieldPending("tempat_lahir")!.new_value} /></div>
                )}
                <input
                  type="text"
                  value={tempatLahir}
                  onChange={e => setTempatLahir(e.target.value)}
                  placeholder="Jakarta"
                  disabled={!!fieldPending("tempat_lahir")}
                  className={`w-full px-3 py-3 rounded-xl border text-sm
                    placeholder:text-gray-400 focus:outline-none focus:ring-2
                    focus:ring-blue-100 focus:border-blue-400 transition-all ${
                      fieldPending("tempat_lahir")
                        ? "border-gray-100 bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "border-gray-200 bg-gray-50 text-gray-900"
                    }`}
                />
              </div>
            </div>

            <SelectField
              label="Jenis Kelamin"
              value={jenisKelamin}
              onChange={setJenisKelamin}
              options={JENIS_KELAMIN_OPTIONS}
              placeholder="Pilih jenis kelamin"
              disabled={!!fieldPending("jenis_kelamin")}
            />
            {fieldPending("jenis_kelamin") && (
              <PendingBadge newValue={fieldPending("jenis_kelamin")!.new_value} />
            )}

            <SelectField
              label="Agama"
              value={agama}
              onChange={setAgama}
              options={AGAMA_OPTIONS}
              placeholder="Pilih agama"
              disabled={!!fieldPending("agama")}
            />
            {fieldPending("agama") && (
              <PendingBadge newValue={fieldPending("agama")!.new_value} />
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-gray-700">
                  Alamat sesuai KTP
                </label>
                {fieldPending("alamat_ktp") && (
                  <PendingBadge newValue={fieldPending("alamat_ktp")!.new_value} />
                )}
              </div>
              <textarea
                value={alamatKtp}
                onChange={e => setAlamatKtp(e.target.value)}
                placeholder="Jl. Contoh No. 1, RT 001/RW 001..."
                rows={3}
                disabled={!!fieldPending("alamat_ktp")}
                className={`w-full px-4 py-3 rounded-xl border text-sm
                  placeholder:text-gray-400 resize-none focus:outline-none
                  focus:ring-2 focus:ring-blue-100 focus:border-blue-400
                  transition-all ${
                    fieldPending("alamat_ktp")
                      ? "border-gray-100 bg-gray-100 text-gray-400 cursor-not-allowed"
                      : "border-gray-200 bg-gray-50 text-gray-900"
                  }`}
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
              disabled={!!fieldPending("pekerjaan")}
            />
            {fieldPending("pekerjaan") && (
              <PendingBadge newValue={fieldPending("pekerjaan")!.new_value} />
            )}

            <SelectField
              label="Status Perkawinan"
              value={statusKawin}
              onChange={setStatusKawin}
              options={STATUS_KAWIN_OPTIONS}
              placeholder="Pilih status perkawinan"
              disabled={!!fieldPending("status_kawin")}
            />
            {fieldPending("status_kawin") && (
              <PendingBadge newValue={fieldPending("status_kawin")!.new_value} />
            )}
          </div>

          {/* ── Section 4: Data RT ───────────────────────────────── */}
          <Section title="Data RT"
            subtitle="Status tinggal dan pendidikan" />
          <div className="px-5 py-4 space-y-4">
            <SelectField
              label="Status Tinggal"
              value={statusTinggal}
              onChange={setStatusTinggal}
              options={STATUS_TINGGAL_OPTIONS}
              disabled={!!fieldPending("status_tinggal")}
            />
            {fieldPending("status_tinggal") && (
              <PendingBadge newValue={fieldPending("status_tinggal")!.new_value} />
            )}

            <SelectField
              label="Pendidikan Terakhir"
              value={pendidikan}
              onChange={setPendidikan}
              options={PENDIDIKAN_OPTIONS}
              placeholder="Pilih pendidikan terakhir"
              disabled={!!fieldPending("pendidikan_terakhir")}
            />
            {fieldPending("pendidikan_terakhir") && (
              <PendingBadge newValue={fieldPending("pendidikan_terakhir")!.new_value} />
            )}
          </div>

          {/* Submit button */}
          <div className="px-5 pb-5 pt-2">
            <button
              onClick={() => mutation.mutate()}
              // disabled={mutation.isPending || !isDirty || !formName.trim() || !formPhone.trim()}
              disabled={mutation.isPending || !isDirty}
              className={`w-full flex items-center justify-center gap-2 py-3
                rounded-xl text-sm font-semibold transition-all ${
                  !mutation.isPending && isDirty
                  // !mutation.isPending && isDirty && formName.trim() && formPhone.trim()
                    ? "bg-blue-900 text-white hover:bg-blue-800 active:scale-[0.98]"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                }`}
            >
              {mutation.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Mengajukan...</>
                : <><Save className="w-4 h-4" /> Ajukan Perubahan</>
              }
            </button>
            {!isDirty && (
              <p className="text-center text-[11px] text-gray-400 mt-2">
                Belum ada perubahan untuk diajukan
              </p>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="mx-4 bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="text-xs font-bold text-amber-800 mb-1">
            ℹ️ Bagaimana cara kerjanya?
          </p>
          <div className="space-y-1 text-xs text-amber-700">
            <p>• Perubahan data akan ditinjau oleh Ketua RT terlebih dahulu</p>
            <p>• Data lama tetap berlaku sampai perubahan disetujui</p>
            <p>• Anda akan melihat status pengajuan di bagian "Riwayat Permintaan"</p>
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
