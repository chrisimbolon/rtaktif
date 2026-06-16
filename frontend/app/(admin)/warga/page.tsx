"use client";
// app/(admin)/warga/page.tsx
// UPDATED: Added TambahWargaModal — Ketua RT manually adds warga data
// KKDetailModal has 3 tabs — Data, Edit, Riwayat Perubahan

import {
  adminCreateResident,
  AGAMA_OPTIONS,
  confirmImport,
  downloadImportTemplate,
  formatDate,
  getResidentChangeLog,
  getWargaFullProfile,
  getWargaList,
  HUBUNGAN_KK_OPTIONS,
  JENIS_KELAMIN_OPTIONS,
  KEWARGANEGARAAN_OPTIONS,
  PEKERJAAN_OPTIONS,
  PENDIDIKAN_OPTIONS,
  previewImport,
  STATUS_KAWIN_OPTIONS,
  STATUS_KELUARGA_OPTIONS,
  STATUS_TINGGAL_OPTIONS,
  suspendWarga,
  updateResidentProfile,
  verifyWarga,
  type AdminCreateResidentPayload,
  type AdminUpdateResidentPayload,
  type ChangeLogEntry,
  type ImportConfirmResponse,
  type ImportPreviewResponse,
  type ResidentDetail,
  type WargaFilter,
  type WargaUser
} from "@/lib/api/warga";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle, ChevronDown, ChevronRight, Clock, Download, Edit3, FileSpreadsheet, History, Home, Loader2, Plus, RefreshCw, Save,
  Search, Upload, UserCheck, UserPlus, Users, X, XCircle,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

const FILTERS: { key: WargaFilter; label: string; icon: React.ReactNode }[] = [
  { key: "all",       label: "Semua",     icon: <Users       className="w-3.5 h-3.5" /> },
  { key: "pending",   label: "Pending",   icon: <Clock       className="w-3.5 h-3.5" /> },
  { key: "active",    label: "Aktif",     icon: <CheckCircle className="w-3.5 h-3.5" /> },
  { key: "suspended", label: "Disuspend", icon: <XCircle     className="w-3.5 h-3.5" /> },
];

type ModalTab = "data" | "edit" | "log";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: WargaUser["status"] }) {
  const cfg = {
    active:    "bg-green-100 text-green-800",
    pending:   "bg-amber-100 text-amber-800",
    suspended: "bg-red-100   text-red-700",
  }[status] ?? "bg-gray-100 text-gray-500";
  const label = { active: "Aktif", pending: "Pending", suspended: "Disuspend" }[status] ?? status;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cfg}`}>
      {label}
    </span>
  );
}

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const s        = name || "W";
  const initials = s.split(" ").slice(0, 2).map((n: string) => n[0]).join("").toUpperCase();
  const colors   = ["bg-blue-500","bg-green-500","bg-purple-500","bg-orange-500","bg-pink-500","bg-teal-500"];
  const sz       = size === "sm" ? "w-7 h-7 text-xs" : "w-9 h-9 text-sm";
  return (
    <div className={`${sz} rounded-full ${colors[s.charCodeAt(0) % colors.length]} flex items-center justify-center text-white font-bold flex-shrink-0`}>
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

// ─── Edit form field components ───────────────────────────────────────────────

function EditField({
  label, name, value, onChange, type = "text", options, placeholder,
}: {
  label:       string;
  name:        string;
  value:       string | boolean | null | undefined;
  onChange:    (name: string, value: string | boolean) => void;
  type?:       "text" | "select" | "textarea" | "date" | "toggle";
  options?:    readonly string[];
  placeholder?: string;
}) {
  const baseInput = "w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all";

  if (type === "toggle") {
    return (
      <div className="flex items-center justify-between py-2">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <button
          type="button"
          onClick={() => onChange(name, !(value as boolean))}
          className={cn(
            "relative inline-flex h-7 w-12 items-center rounded-full transition-colors",
            value ? "bg-blue-600" : "bg-gray-200"
          )}
        >
          <span className={cn(
            "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
            value ? "translate-x-6" : "translate-x-1"
          )} />
        </button>
      </div>
    );
  }

  if (type === "select" && options) {
    return (
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">{label}</label>
        <select
          value={(value as string) ?? ""}
          onChange={(e) => onChange(name, e.target.value)}
          className={baseInput}
        >
          <option value="">— Pilih —</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  }

  if (type === "textarea") {
    return (
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">{label}</label>
        <textarea
          value={(value as string) ?? ""}
          onChange={(e) => onChange(name, e.target.value)}
          rows={3}
          placeholder={placeholder}
          className={cn(baseInput, "resize-none")}
        />
      </div>
    );
  }

  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1.5">{label}</label>
      <input
        type={type}
        value={(value as string) ?? ""}
        onChange={(e) => onChange(name, e.target.value)}
        placeholder={placeholder}
        className={baseInput}
      />
    </div>
  );
}

// ─── Change log tab ───────────────────────────────────────────────────────────

function ChangeLogTab({ residentId }: { residentId: string }) {
  const { data: logs = [], isLoading } = useQuery<ChangeLogEntry[]>({
    queryKey: ["change-log", residentId],
    queryFn:  () => getResidentChangeLog(residentId),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="py-12 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="py-12 text-center">
        <History className="w-8 h-8 text-gray-200 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-600">Belum ada riwayat perubahan</p>
        <p className="text-xs text-gray-400 mt-1">Perubahan data akan muncul di sini</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {logs.map((log) => {
        const date = new Date(log.changed_at).toLocaleDateString("id-ID", {
          day: "numeric", month: "short", year: "numeric",
          hour: "2-digit", minute: "2-digit",
        });
        const roleLabel = log.changed_by_role === "ketua_rt" ? "Ketua RT" :
                          log.changed_by_role === "superadmin" ? "Superadmin" : "Warga";
        return (
          <div key={log.id} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <span className="text-xs font-semibold text-gray-800">{log.field_label}</span>
                <span className={cn(
                  "ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                  log.changed_by_role === "ketua_rt"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-gray-200 text-gray-600"
                )}>
                  {roleLabel}
                </span>
              </div>
              <span className="text-[10px] text-gray-400 flex-shrink-0">{date}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2 py-1 rounded bg-red-50 text-red-700 font-mono line-through">
                {log.old_value ?? "—"}
              </span>
              <span className="text-gray-400">→</span>
              <span className="px-2 py-1 rounded bg-green-50 text-green-700 font-mono font-medium">
                {log.new_value ?? "—"}
              </span>
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5">
              Diubah oleh {log.changed_by_name}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ─── KK Member Card ───────────────────────────────────────────────────────────

function KKMemberCard({ member, isMain = false }: { member: ResidentDetail; isMain?: boolean }) {
  const [expanded, setExpanded] = useState(isMain);
  return (
    <div className={`rounded-xl border ${isMain ? "border-blue-200 bg-blue-50" : "border-gray-200 bg-white"} overflow-hidden`}>
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-black/5 transition-colors"
      >
        <Avatar name={member.full_name} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 truncate">
            {member.full_name}
            {member.kepala_keluarga && (
              <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-900 text-white">KK</span>
            )}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {member.hubungan_dengan_kk ?? member.status_keluarga ?? "—"}
            {member.pendidikan_terakhir && ` · ${member.pendidikan_terakhir}`}
          </p>
        </div>
        <ChevronRight className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`} />
      </button>
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100">
          <div className="mt-3">
            <DataRow label="NIK"             value={member.nik} />
            <DataRow label="No. KK"          value={member.no_kk} />
            <DataRow label="Tempat Lahir"    value={member.tempat_lahir} />
            <DataRow label="Tanggal Lahir"   value={member.tanggal_lahir
              ? new Date(member.tanggal_lahir).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
              : null} />
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

// ─── Import Warga Modal ═══════════════════════════════════════════════════════
type ImportStep = "upload" | "preview" | "result";

function ImportWargaModal({
  rtGroupId,
  onClose,
}: {
  rtGroupId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [step,     setStep]     = useState<ImportStep>("upload");
  const [preview,  setPreview]  = useState<ImportPreviewResponse | null>(null);
  const [result,   setResult]   = useState<ImportConfirmResponse | null>(null);
  const [previewTab, setPreviewTab] = useState<"valid" | "errors">("valid");
  const [dragOver, setDragOver] = useState(false);

  // ── Upload mutation ────────────────────────────────────────────────────────
  const uploadMutation = useMutation({
    mutationFn: (file: File) => previewImport(file),
    onSuccess: (data) => {
      setPreview(data);
      setPreviewTab(data.valid_count > 0 ? "valid" : "errors");
      setStep("preview");
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail;
      const msg = typeof detail === "string" ? detail : "Gagal membaca file";
      toast.error(msg);
    },
  });

  // ── Confirm mutation ───────────────────────────────────────────────────────
  const confirmMutation = useMutation({
    mutationFn: () => confirmImport(preview!.valid),
    onSuccess: (data) => {
      setResult(data);
      setStep("result");
      queryClient.invalidateQueries({ queryKey: ["warga", rtGroupId] });
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Gagal mengimport data");
    },
  });

  // ── File handling ──────────────────────────────────────────────────────────
  const handleFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      toast.error("Hanya file .xlsx yang didukung");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ukuran file maksimal 5 MB");
      return;
    }
    uploadMutation.mutate(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  // ── Step titles ────────────────────────────────────────────────────────────
  const stepTitle = {
    upload:  "Import Data Warga",
    preview: "Preview Import",
    result:  "Import Selesai",
  }[step];

  const stepSubtitle = {
    upload:  "Upload file Excel sesuai template RTMudah",
    preview: preview
      ? `${preview.valid_count} siap diimport · ${preview.error_count} bermasalah`
      : "",
    result: result ? `${result.imported} warga berhasil ditambahkan` : "",
  }[step];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-4">

        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <FileSpreadsheet className="w-4 h-4 text-green-700" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">{stepTitle}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{stepSubtitle}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 max-h-[65vh] overflow-y-auto">

          {/* ── STEP 1: UPLOAD ── */}
          {step === "upload" && (
            <div className="space-y-4">
              {/* Download template */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-blue-800">
                    Belum punya template?
                  </p>
                  <p className="text-xs text-blue-600 mt-0.5">
                    Download template Excel RTMudah, isi data, lalu upload di sini.
                  </p>
                </div>
                <button
                  onClick={() => downloadImportTemplate()}
                  className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Template
                </button>
              </div>

              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={cn(
                  "border-2 border-dashed rounded-xl p-10 text-center transition-all",
                  dragOver
                    ? "border-green-400 bg-green-50"
                    : "border-gray-200 hover:border-green-300 hover:bg-gray-50"
                )}
              >
                {uploadMutation.isPending ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-green-600" />
                    <p className="text-sm font-medium text-gray-600">
                      Membaca dan memvalidasi file…
                    </p>
                  </div>
                ) : (
                  <label className="cursor-pointer flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center">
                      <Upload className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-700">
                        Drag & drop file Excel di sini
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        atau <span className="text-green-600 font-semibold underline">pilih file</span>
                        {" "}· Hanya .xlsx · Maks. 5 MB
                      </p>
                    </div>
                    <input
                      type="file"
                      accept=".xlsx"
                      className="hidden"
                      onChange={handleFileInput}
                    />
                  </label>
                )}
              </div>

              {/* Rules */}
              <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-1.5">
                <p className="text-xs font-semibold text-gray-600">Aturan pengisian:</p>
                <ul className="text-xs text-gray-500 space-y-1 list-disc list-inside">
                  <li>Baris 1 = header (jangan diubah)</li>
                  <li>Kolom <strong>nama_lengkap</strong> dan <strong>no_whatsapp</strong> wajib diisi</li>
                  <li>Tanggal lahir format: <strong>DD-MM-YYYY</strong> atau <strong>DD/MM/YYYY</strong> (cth: 21-05-1990)</li>
                  <li>NIK dan No. KK harus <strong>16 digit angka</strong></li>
                  <li>Maksimal <strong>500 baris</strong> per file</li>
                </ul>
              </div>
            </div>
          )}

          {/* ── STEP 2: PREVIEW ── */}
          {step === "preview" && preview && (
            <div className="space-y-4">
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-extrabold text-gray-800">{preview.total_rows}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Total Baris</p>
                </div>
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-extrabold text-green-700">{preview.valid_count}</p>
                  <p className="text-xs text-green-600 mt-0.5">Siap Import</p>
                </div>
                <div className={cn(
                  "rounded-xl p-3 text-center",
                  preview.error_count > 0 ? "bg-red-50" : "bg-gray-50"
                )}>
                  <p className={cn(
                    "text-xl font-extrabold",
                    preview.error_count > 0 ? "text-red-600" : "text-gray-400"
                  )}>
                    {preview.error_count}
                  </p>
                  <p className={cn(
                    "text-xs mt-0.5",
                    preview.error_count > 0 ? "text-red-500" : "text-gray-400"
                  )}>
                    Bermasalah
                  </p>
                </div>
              </div>

              {/* Warning if errors exist */}
              {preview.error_count > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <p className="text-xs text-amber-800 font-medium">
                    ⚠️ {preview.error_count} baris bermasalah tidak akan diimport.
                    Perbaiki di file Excel lalu upload ulang, atau lanjutkan import
                    {preview.valid_count > 0 ? ` ${preview.valid_count} baris yang valid` : ""}.
                  </p>
                </div>
              )}

              {/* Tab bar */}
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setPreviewTab("valid")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-semibold transition-all",
                    previewTab === "valid"
                      ? "bg-white text-green-700 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  Valid ({preview.valid_count})
                </button>
                <button
                  onClick={() => setPreviewTab("errors")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-semibold transition-all",
                    previewTab === "errors"
                      ? "bg-white text-red-600 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Error ({preview.error_count})
                </button>
              </div>

              {/* Valid rows table */}
              {previewTab === "valid" && (
                <div className="rounded-xl border border-gray-100 overflow-hidden">
                  {preview.valid.length === 0 ? (
                    <div className="py-8 text-center text-sm text-gray-400">
                      Tidak ada baris yang valid
                    </div>
                  ) : (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="px-3 py-2 text-left font-semibold text-gray-500 w-12">#</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-500">Nama</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-500">No. WA</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-500">NIK</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-500 w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.valid.map((row) => (
                          <tr key={row.row} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-400">{row.row}</td>
                            <td className="px-3 py-2 font-medium text-gray-800">{row.full_name}</td>
                            <td className="px-3 py-2 text-gray-600 font-mono">{row.phone}</td>
                            <td className="px-3 py-2 text-gray-400 font-mono">{row.nik || "—"}</td>
                            <td className="px-3 py-2">
                              <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* Error rows table */}
              {previewTab === "errors" && (
                <div className="rounded-xl border border-red-100 overflow-hidden">
                  {preview.errors.length === 0 ? (
                    <div className="py-8 text-center text-sm text-gray-400">
                      Tidak ada error 🎉
                    </div>
                  ) : (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-red-50 border-b border-red-100">
                          <th className="px-3 py-2 text-left font-semibold text-red-700 w-12">Baris</th>
                          <th className="px-3 py-2 text-left font-semibold text-red-700">Field</th>
                          <th className="px-3 py-2 text-left font-semibold text-red-700">Nilai</th>
                          <th className="px-3 py-2 text-left font-semibold text-red-700">Masalah</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.errors.map((err, i) => (
                          <tr key={i} className="border-b border-red-50 last:border-0 bg-white hover:bg-red-50/30">
                            <td className="px-3 py-2 text-gray-500">{err.row}</td>
                            <td className="px-3 py-2 font-mono text-red-700">{err.field}</td>
                            <td className="px-3 py-2 text-gray-500 max-w-[120px] truncate">
                              {err.value || "—"}
                            </td>
                            <td className="px-3 py-2 text-red-600">{err.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── STEP 3: RESULT ── */}
          {step === "result" && result && (
            <div className="py-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900">
                  {result.imported} warga berhasil diimport!
                </p>
                {result.failed > 0 && (
                  <p className="text-sm text-red-500 mt-1">
                    {result.failed} baris gagal tersimpan
                  </p>
                )}
              </div>
              {result.failed_rows.length > 0 && (
                <div className="text-left bg-red-50 rounded-xl p-4 space-y-1">
                  <p className="text-xs font-semibold text-red-700 mb-2">Baris yang gagal:</p>
                  {result.failed_rows.map((f, i) => (
                    <p key={i} className="text-xs text-red-600">
                      Baris {f.row}: {f.reason}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          {step === "upload" && (
            <button onClick={onClose}
              className="w-full py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
              Batal
            </button>
          )}

          {step === "preview" && (
            <>
              <button
                onClick={() => { setStep("upload"); setPreview(null); }}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                ← Upload Ulang
              </button>
              <button
                onClick={() => confirmMutation.mutate()}
                disabled={!preview || preview.valid_count === 0 || confirmMutation.isPending}
                className={cn(
                  "flex-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all",
                  preview && preview.valid_count > 0 && !confirmMutation.isPending
                    ? "bg-green-600 text-white hover:bg-green-700 active:scale-[0.98]"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                )}
              >
                {confirmMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Mengimport…</>
                ) : (
                  <><Upload className="w-4 h-4" /> Import {preview?.valid_count ?? 0} Warga</>
                )}
              </button>
            </>
          )}

          {step === "result" && (
            <button onClick={onClose}
              className="w-full py-3 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors">
              Selesai
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tambah Warga Modal ═══════════════════════════════════════════════════════
// === ADDED — modal for Ketua RT to manually add a warga without a login account

const EMPTY_FORM: AdminCreateResidentPayload = {
  full_name: "",
  phone:     "",
};

function TambahWargaModal({ onClose, rtGroupId }: { onClose: () => void; rtGroupId: string }) {
// function TambahWargaModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm]           = useState<AdminCreateResidentPayload>(EMPTY_FORM);
  const [showDetail, setShowDetail] = useState(false);

  const handleChange = (name: string, value: string | boolean) => {
    setForm(prev => ({ ...prev, [name]: value as string }));
  };

  // Build payload — strip empty optional strings so backend doesn't get ""
  const buildPayload = (): AdminCreateResidentPayload => {
    const p: AdminCreateResidentPayload = {
      full_name: form.full_name.trim(),
      phone:     form.phone.trim(),
    };
    if (form.nik?.trim())             p.nik             = form.nik.trim();
    if (form.no_kk?.trim())           p.no_kk           = form.no_kk.trim();
    if (form.status_keluarga?.trim()) p.status_keluarga = form.status_keluarga.trim();
    if (form.alamat_ktp?.trim())      p.alamat_ktp      = form.alamat_ktp.trim();
    if (form.alamat_domisili?.trim()) p.alamat_domisili = form.alamat_domisili.trim();
    return p;
  };

  const isValid = form.full_name.trim().length >= 3 && form.phone.trim().length >= 9;

  const createMutation = useMutation({
    mutationFn: () => adminCreateResident(buildPayload()),
    onSuccess: (result) => {
      toast.success(`✅ ${result.message}`);
      // queryClient.invalidateQueries({ queryKey: ["warga"] });
      queryClient.invalidateQueries({ queryKey: ["warga", rtGroupId] });
      onClose();
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail;
      const msg = typeof detail === "string"
        ? detail
        : Array.isArray(detail)
        ? detail.map((e: any) => e.msg).join(", ")
        : "Gagal menambahkan warga";
      toast.error(msg);
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md my-4">

        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <UserPlus className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Tambah Warga</h3>
              <p className="text-xs text-gray-500 mt-0.5">Data warga tanpa akun login</p>
            </div>
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">

          {/* Info banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
            <p className="text-xs text-blue-800 font-medium leading-relaxed">
              💡 Masukkan data warga yang belum punya akun di RTMudah.
              Hanya <strong>Nama</strong> dan <strong>No. WhatsApp</strong> yang wajib diisi —
              data lainnya bisa dilengkapi kapan saja via tombol Edit.
            </p>
          </div>

          {/* Wajib diisi */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
              Wajib Diisi
            </p>
            <div className="space-y-3">
              <EditField
                label="Nama Lengkap *"
                name="full_name"
                value={form.full_name}
                onChange={handleChange}
                placeholder="cth. Budi Santoso"
              />
              <EditField
                label="No. WhatsApp *"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="cth. 081234567890"
              />
            </div>
          </div>

          {/* Detail Tambahan — collapsible */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowDetail(d => !d)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
            >
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Detail Tambahan <span className="font-normal normal-case text-gray-400">(opsional)</span>
              </span>
              <ChevronDown className={cn(
                "w-4 h-4 text-gray-400 transition-transform",
                showDetail ? "rotate-180" : ""
              )} />
            </button>

            {showDetail && (
              <div className="px-4 pb-4 space-y-3 border-t border-gray-100">
                <div className="pt-3">
                  <EditField
                    label="NIK (16 digit)"
                    name="nik"
                    value={form.nik ?? ""}
                    onChange={handleChange}
                    placeholder="cth. 1771234567890001"
                  />
                </div>
                <EditField
                  label="Nomor KK (16 digit)"
                  name="no_kk"
                  value={form.no_kk ?? ""}
                  onChange={handleChange}
                  placeholder="cth. 1771234567890001"
                />
                <EditField
                  label="Status Keluarga"
                  name="status_keluarga"
                  value={form.status_keluarga ?? ""}
                  onChange={handleChange}
                  type="select"
                  options={STATUS_KELUARGA_OPTIONS}
                />
                <EditField
                  label="Alamat KTP"
                  name="alamat_ktp"
                  value={form.alamat_ktp ?? ""}
                  onChange={handleChange}
                  type="textarea"
                  placeholder="Alamat sesuai KTP"
                />
                <EditField
                  label="Alamat Domisili"
                  name="alamat_domisili"
                  value={form.alamat_domisili ?? ""}
                  onChange={handleChange}
                  type="textarea"
                  placeholder="Alamat tinggal saat ini (jika beda dari KTP)"
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Batal
          </button>
          <button
            onClick={() => createMutation.mutate()}
            disabled={!isValid || createMutation.isPending}
            className={cn(
              "flex-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all",
              isValid && !createMutation.isPending
                ? "bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            )}
          >
            {createMutation.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan…</>
            ) : (
              <><Plus className="w-4 h-4" /> Tambah Warga</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── KK Detail Modal (3 tabs: Data | Edit | Riwayat) ─────────────────────────

function KKDetailModal({ user, onClose }: { user: WargaUser; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ModalTab>("data");

  const { data: profile, isLoading } = useQuery<ResidentDetail>({
    queryKey: ["warga-profile", user.id],
    queryFn:  () => getWargaFullProfile(user.id),
    staleTime: 60_000,
  });

  const [editForm, setEditForm] = useState<AdminUpdateResidentPayload>({});
  const [formDirty, setFormDirty] = useState(false);

  const handleTabChange = (tab: ModalTab) => {
    if (tab === "edit" && profile && !formDirty) {
      const form: AdminUpdateResidentPayload = {};
      if (profile.full_name)           form.full_name           = profile.full_name;
      if (profile.phone)               form.phone               = profile.phone;
      if (profile.nik)                 form.nik                 = profile.nik;
      if (profile.no_kk)               form.no_kk               = profile.no_kk;
      if (profile.tanggal_lahir)       form.tanggal_lahir       = profile.tanggal_lahir;
      if (profile.tempat_lahir)        form.tempat_lahir        = profile.tempat_lahir;
      if (profile.jenis_kelamin)       form.jenis_kelamin       = profile.jenis_kelamin;
      if (profile.agama)               form.agama               = profile.agama;
      if (profile.pekerjaan)           form.pekerjaan           = profile.pekerjaan;
      if (profile.status_kawin)        form.status_kawin        = profile.status_kawin;
      if (profile.status_tinggal)      form.status_tinggal      = profile.status_tinggal;
      if (profile.status_keluarga)     form.status_keluarga     = profile.status_keluarga;
      if (profile.alamat_ktp)          form.alamat_ktp          = profile.alamat_ktp;
      if (profile.pendidikan_terakhir) form.pendidikan_terakhir = profile.pendidikan_terakhir;
      if (profile.kewarganegaraan)     form.kewarganegaraan     = profile.kewarganegaraan;
      if (profile.hubungan_dengan_kk)  form.hubungan_dengan_kk  = profile.hubungan_dengan_kk;
      form.kepala_keluarga = profile.kepala_keluarga ?? false;
      setEditForm(form);
    }
    setActiveTab(tab);
  };

  const handleFieldChange = (name: string, value: string | boolean) => {
    setEditForm(prev => ({ ...prev, [name]: value }));
    setFormDirty(true);
  };

  const updateMutation = useMutation({
    mutationFn: () => updateResidentProfile(profile!.id, editForm),
    onSuccess: (result) => {
      if (result.changed_fields === 0) {
        toast.info("Tidak ada perubahan data");
        return;
      }
      toast.success(`✅ ${result.message} — ${result.changed_fields} field diperbarui`);
      queryClient.invalidateQueries({ queryKey: ["warga-profile", user.id] });
      queryClient.invalidateQueries({ queryKey: ["change-log", profile!.id] });
      queryClient.invalidateQueries({ queryKey: ["warga"] });
      setFormDirty(false);
      setActiveTab("data");
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail;
      const msg = typeof detail === "string"
        ? detail
        : Array.isArray(detail)
        ? detail.map((e: any) => e.msg).join(", ")
        : "Gagal menyimpan perubahan";
      toast.error(msg);
    },
  });

  const completeness = useMemo(() => {
    if (!profile) return 0;
    const fields = [
      profile.nik, profile.no_kk, profile.tanggal_lahir,
      profile.tempat_lahir, profile.jenis_kelamin, profile.agama,
      profile.pekerjaan, profile.status_kawin, profile.pendidikan_terakhir,
      profile.hubungan_dengan_kk, profile.kewarganegaraan,
    ];
    return Math.round((fields.filter(Boolean).length / fields.length) * 100);
  }, [profile]);

  const TABS: { key: ModalTab; label: string; icon: React.ReactNode }[] = [
    { key: "data", label: "Data",    icon: <Users   className="w-3.5 h-3.5" /> },
    { key: "edit", label: "Edit",    icon: <Edit3   className="w-3.5 h-3.5" /> },
    { key: "log",  label: "Riwayat", icon: <History className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg my-4">

        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar name={user.full_name} />
            <div>
              <h3 className="font-bold text-gray-900">{user.full_name}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{user.email}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="px-6 pt-3 flex gap-1 border-b border-gray-100">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px",
                activeTab === tab.key
                  ? "text-blue-700 border-blue-600 bg-blue-50"
                  : "text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50"
              )}
            >
              {tab.icon}
              {tab.label}
              {tab.key === "edit" && formDirty && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 ml-1" />
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="py-12 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : !profile ? (
            <div className="py-8 text-center">
              <Home className="w-8 h-8 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-700">Data kependudukan belum diisi</p>
            </div>
          ) : (
            <>
              {activeTab === "data" && (
                <>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-gray-700">Kelengkapan Data</p>
                      <span className={cn("text-xs font-bold",
                        completeness >= 80 ? "text-green-600" :
                        completeness >= 50 ? "text-amber-600" : "text-red-500"
                      )}>
                        {completeness}%
                      </span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all",
                          completeness >= 80 ? "bg-green-500" :
                          completeness >= 50 ? "bg-amber-500" : "bg-red-400"
                        )}
                        style={{ width: `${completeness}%` }}
                      />
                    </div>
                    {profile.no_kk && (
                      <p className="text-xs text-gray-500 mt-2">
                        No. KK: <span className="font-mono font-semibold">{profile.no_kk}</span>
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Data Pribadi</p>
                    <KKMemberCard member={profile} isMain={true} />
                  </div>
                  {profile.kk_members && profile.kk_members.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                        Anggota KK ({profile.kk_members.length} orang)
                      </p>
                      <div className="space-y-2">
                        {profile.kk_members.map((m: ResidentDetail) => (
                          <KKMemberCard key={m.id} member={m} />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {activeTab === "edit" && (
                <div className="space-y-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                    <p className="text-xs text-amber-800 font-medium">
                      ⚡ Perubahan sebagai Ketua RT langsung tersimpan dan tercatat di riwayat.
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Akun</p>
                    <div className="space-y-3">
                      <EditField label="Nama Lengkap"     name="full_name"  value={editForm.full_name}  onChange={handleFieldChange} />
                      <EditField label="Nomor HP"         name="phone"      value={editForm.phone}      onChange={handleFieldChange} />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Identitas KTP</p>
                    <div className="space-y-3">
                      <EditField label="NIK (16 digit)"   name="nik"           value={editForm.nik}           onChange={handleFieldChange} />
                      <EditField label="Nomor KK"         name="no_kk"         value={editForm.no_kk}         onChange={handleFieldChange} />
                      <EditField label="Tanggal Lahir"    name="tanggal_lahir" value={editForm.tanggal_lahir} onChange={handleFieldChange} type="date" />
                      <EditField label="Tempat Lahir"     name="tempat_lahir"  value={editForm.tempat_lahir}  onChange={handleFieldChange} />
                      <EditField label="Jenis Kelamin"    name="jenis_kelamin" value={editForm.jenis_kelamin} onChange={handleFieldChange} type="select" options={JENIS_KELAMIN_OPTIONS} />
                      <EditField label="Agama"            name="agama"         value={editForm.agama}         onChange={handleFieldChange} type="select" options={AGAMA_OPTIONS} />
                      <EditField label="Alamat KTP"       name="alamat_ktp"    value={editForm.alamat_ktp}    onChange={handleFieldChange} type="textarea" />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Data Sosial</p>
                    <div className="space-y-3">
                      <EditField label="Pekerjaan"         name="pekerjaan"           value={editForm.pekerjaan}           onChange={handleFieldChange} type="select" options={PEKERJAAN_OPTIONS} />
                      <EditField label="Status Perkawinan" name="status_kawin"         value={editForm.status_kawin}        onChange={handleFieldChange} type="select" options={STATUS_KAWIN_OPTIONS} />
                      <EditField label="Pendidikan"        name="pendidikan_terakhir"  value={editForm.pendidikan_terakhir} onChange={handleFieldChange} type="select" options={PENDIDIKAN_OPTIONS} />
                      <EditField label="Kewarganegaraan"   name="kewarganegaraan"      value={editForm.kewarganegaraan}     onChange={handleFieldChange} type="select" options={KEWARGANEGARAAN_OPTIONS} />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Data RT</p>
                    <div className="space-y-3">
                      <EditField label="Status Tinggal"  name="status_tinggal"    value={editForm.status_tinggal}    onChange={handleFieldChange} type="select" options={STATUS_TINGGAL_OPTIONS} />
                      <EditField label="Status Keluarga" name="status_keluarga"   value={editForm.status_keluarga}   onChange={handleFieldChange} type="select" options={STATUS_KELUARGA_OPTIONS} />
                      <EditField label="Hubungan KK"     name="hubungan_dengan_kk" value={editForm.hubungan_dengan_kk} onChange={handleFieldChange} type="select" options={HUBUNGAN_KK_OPTIONS} />
                      <EditField label="Kepala Keluarga" name="kepala_keluarga"   value={editForm.kepala_keluarga}   onChange={handleFieldChange} type="toggle" />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "log" && (
                <ChangeLogTab residentId={profile.id} />
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          {activeTab === "edit" ? (
            <>
              <button
                onClick={() => { setFormDirty(false); setActiveTab("data"); }}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={() => updateMutation.mutate()}
                disabled={!formDirty || updateMutation.isPending || !profile}
                className={cn(
                  "flex-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all",
                  formDirty && !updateMutation.isPending
                    ? "bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                )}
              >
                {updateMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan…</>
                ) : (
                  <><Save className="w-4 h-4" /> Simpan Perubahan</>
                )}
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Tutup
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Warga Row ────────────────────────────────────────────────────────────────

function WargaRow({ user, rtGroupId, onVerify, onSuspend, isActionLoading, onViewProfile }: {
  user: WargaUser; rtGroupId: string;
  onVerify: (id: string) => void; onSuspend: (id: string) => void;
  isActionLoading: boolean; onViewProfile: (user: WargaUser) => void;
}) {
  return (
    <tr onClick={() => onViewProfile(user)}
      className="border-b border-gray-50 hover:bg-blue-50/40 transition-colors cursor-pointer group">
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <Avatar name={user.full_name} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-blue-700 transition-colors">
              {user.full_name}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {user.email || <span className="italic text-gray-400">Belum punya akun</span>}
            </p>
            {user.phone && <p className="text-xs text-gray-400">{user.phone}</p>}
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
          {user.role === "ketua_rt" ? "ketua rt" : user.role}
        </span>
      </td>
      <td className="px-6 py-4"><StatusBadge status={user.status} /></td>
      <td className="px-6 py-4 text-xs text-gray-500 whitespace-nowrap">{formatDate(user.created_at)}</td>
      <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 justify-end">
          {user.status === "pending" && (
            <button onClick={() => onVerify(user.id)} disabled={isActionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700 text-white text-xs font-semibold rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors">
              <UserCheck className="w-3.5 h-3.5" /> Verifikasi
            </button>
          )}
          {user.status === "active" && user.role !== "ketua_rt" && !user.is_ghost && (
            <button onClick={() => onSuspend(user.id)} disabled={isActionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors">
              <XCircle className="w-3.5 h-3.5" /> Suspend
            </button>
          )}
          {user.status === "suspended" && (
            <button onClick={() => onVerify(user.id)} disabled={isActionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-green-200 text-green-700 text-xs font-semibold rounded-lg hover:bg-green-50 disabled:opacity-50 transition-colors">
              <CheckCircle className="w-3.5 h-3.5" /> Aktifkan
            </button>
          )}
          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-400 transition-colors" />
        </div>
      </td>
    </tr>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WargaPage() {
  const { data: session }  = useSession();
  const queryClient        = useQueryClient();
  const rtGroupId          = (session?.user as any)?.rt_group_id as string | null;

  const [filter,         setFilter]         = useState<WargaFilter>("all");
  const [search,         setSearch]         = useState("");
  const [actionId,       setActionId]       = useState<string | null>(null);
  const [selectedUser,   setSelectedUser]   = useState<WargaUser | null>(null);
  // === ADDED — controls TambahWargaModal visibility
  const [showTambah,     setShowTambah]     = useState(false);
  const [showImport, setShowImport] = useState(false);

  const { data: wargaList = [], isLoading, isError, refetch } = useQuery({
    queryKey:  ["warga", rtGroupId, filter],
    queryFn:   () => getWargaList(rtGroupId!, filter),
    enabled:   !!rtGroupId,
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
    onSuccess:  () => {
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

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {FILTERS.map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                  filter === f.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                )}>
                {f.icon} {f.label}
                {f.key === "pending" && pendingCount > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500 text-white">
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="relative flex-1 w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input type="text" placeholder="Cari nama, email, HP..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400" />
          </div>
          {/* === ADDED — Tambah Warga button */}
          <button
            onClick={() => setShowTambah(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 active:scale-[0.98] transition-all flex-shrink-0"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Tambah Warga
          </button>

          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 active:scale-[0.98] transition-all flex-shrink-0"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Import Excel
          </button>

          <button onClick={() => refetch()}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors flex-shrink-0">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-2 bg-blue-50 border-b border-blue-100">
          <p className="text-xs text-blue-600">
            💡 Klik nama warga untuk melihat detail, edit data, atau riwayat perubahan
          </p>
        </div>

        {isLoading ? (
          <div className="py-12 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        ) : isError ? (
          <div className="text-center py-12">
            <p className="font-bold text-gray-800">Gagal memuat data</p>
            <button onClick={() => refetch()} className="mt-2 text-sm text-blue-600 hover:underline">Coba lagi</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">👥</div>
            <p className="font-bold text-gray-800">
              {search ? "Tidak ada hasil pencarian" : "Belum ada warga"}
            </p>
            {!search && (
              <button
                onClick={() => setShowTambah(true)}
                className="mt-4 flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors mx-auto"
              >
                <UserPlus className="w-4 h-4" /> Tambah Warga Pertama
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {["Warga", "Role", "Status", "Bergabung", "Aksi"].map(h => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(user => (
                  <WargaRow key={user.id} user={user} rtGroupId={rtGroupId}
                    onVerify={(id) => verifyMutation.mutate(id)}
                    onSuspend={(id) => suspendMutation.mutate(id)}
                    isActionLoading={actionId === user.id}
                    onViewProfile={setSelectedUser} />
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

      {/* === ADDED — Tambah Warga modal */}
      {showTambah && (
        // <TambahWargaModal onClose={() => setShowTambah(false)} />
        <TambahWargaModal onClose={() => setShowTambah(false)} rtGroupId={rtGroupId} />

      )}

      {showImport && (
        <ImportWargaModal rtGroupId={rtGroupId}onClose={() => setShowImport(false)} />
      )}

      {selectedUser && (
        <KKDetailModal user={selectedUser} onClose={() => setSelectedUser(null)} />
      )}
    </div>
  );
}
