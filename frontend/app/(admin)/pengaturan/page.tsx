"use client";
// app/(admin)/pengaturan/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// /pengaturan — RT Group Settings
//
// What it does:
//   1. Loads current RT group data from FastAPI using backendToken
//   2. Lets admin edit all RT fields + monthly fee
//   3. Saves via PATCH /rt-groups/{id}
//   4. Shows inline success/error toasts via sonner
//   5. Handles "no RT group yet" state with a Create flow
//
// Data flow:
//   useSession() → backendToken + rt_group_id → fetch RT → render form
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useCallback } from "react";
import { useSession }                        from "next-auth/react";
import { toast }                             from "sonner";
import type { RTGroup }                      from "@/types";
import { getRTGroupClient, updateRTGroupClient, extractApiError } from "@/lib/api/rtgroup";
import apiClient from "@/lib/api/client";

// ── Types ────────────────────────────────────────────────────────────────────

interface FormState {
  rt_number:       string;
  rw_number:       string;
  kelurahan:       string;
  kecamatan:       string;
  kota:            string;
  provinsi:        string;
  monthly_fee_idr: string; // string in form, number when sent
}

type PageState = "loading" | "no-rt" | "ready" | "error";

// ── Helpers ──────────────────────────────────────────────────────────────────

function rtToForm(rt: RTGroup): FormState {
  return {
    rt_number:       rt.rt_number,
    rw_number:       rt.rw_number,
    kelurahan:       rt.kelurahan,
    kecamatan:       rt.kecamatan,
    kota:            rt.kota,
    provinsi:        rt.provinsi,
    monthly_fee_idr: String(rt.monthly_fee_idr),
  };
}

const PROVINSI_LIST = [
  "Aceh","Sumatera Utara","Sumatera Barat","Riau","Kepulauan Riau",
  "Jambi","Bengkulu","Sumatera Selatan","Kepulauan Bangka Belitung",
  "Lampung","DKI Jakarta","Jawa Barat","Banten","Jawa Tengah",
  "DI Yogyakarta","Jawa Timur","Bali","Nusa Tenggara Barat",
  "Nusa Tenggara Timur","Kalimantan Barat","Kalimantan Tengah",
  "Kalimantan Selatan","Kalimantan Timur","Kalimantan Utara",
  "Sulawesi Utara","Gorontalo","Sulawesi Tengah","Sulawesi Selatan",
  "Sulawesi Barat","Sulawesi Tenggara","Maluku","Maluku Utara",
  "Papua Barat","Papua",
];

// ── Sub-components ────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="animate-pulse space-y-4">
      {[1,2,3,4].map(i => (
        <div key={i} className="h-12 bg-gray-100 rounded-lg" />
      ))}
    </div>
  );
}

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
      {label}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

function Input({
  value, onChange, placeholder, type = "text", readOnly,
}: {
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  type?: string;
  readOnly?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      readOnly={readOnly}
      onChange={e => onChange?.(e.target.value)}
      placeholder={placeholder}
      className={`w-full px-4 py-2.5 rounded-lg border text-sm transition-colors
        ${readOnly
          ? "bg-gray-50 border-gray-200 text-gray-500 cursor-not-allowed"
          : "bg-white border-gray-300 text-gray-900 hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
        }`}
    />
  );
}

function Select({
  value, onChange, options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm bg-white
        text-gray-900 hover:border-blue-400 focus:border-blue-500 focus:ring-2
        focus:ring-blue-100 outline-none transition-colors"
    >
      {options.map(opt => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  );
}

// ── No RT Banner ──────────────────────────────────────────────────────────────

function NoRTBanner({ onCreated }: { onCreated: (rt: RTGroup) => void }) {
  const { data: session } = useSession();
  const [form, setForm]   = useState<FormState>({
    rt_number: "", rw_number: "", kelurahan: "",
    kecamatan: "", kota: "", provinsi: "Bengkulu",
    monthly_fee_idr: "30000",
  });
  const [saving, setSaving] = useState(false);

  const set = (k: keyof FormState) => (v: string) =>
    setForm(prev => ({ ...prev, [k]: v }));

  async function handleCreate() {
    if (!form.rt_number || !form.rw_number || !form.kelurahan || !form.kecamatan || !form.kota) {
      toast.error("Lengkapi semua field wajib");
      return;
    }
    setSaving(true);
    try {
      const { data } = await apiClient.post("/rt-groups", {
        rt_number:       form.rt_number,
        rw_number:       form.rw_number,
        kelurahan:       form.kelurahan,
        kecamatan:       form.kecamatan,
        kota:            form.kota,
        provinsi:        form.provinsi,
        monthly_fee_idr: Number(form.monthly_fee_idr) || 30000,
      });
      toast.success(`✅ RT ${data.display_name} berhasil dibuat!`);
      onCreated(data);
    } catch (err) {
      toast.error(extractApiError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      {/* Alert banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 mb-8">
        <div className="text-amber-500 text-xl flex-shrink-0">⚠️</div>
        <div>
          <div className="font-semibold text-amber-800 text-sm">RT belum dikonfigurasi</div>
          <div className="text-amber-700 text-xs mt-0.5">
            Buat data RT Anda terlebih dahulu sebelum menggunakan fitur lainnya.
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
        <h2 className="font-bold text-gray-900">Buat RT Baru</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel label="Nomor RT" required />
            <Input value={form.rt_number} onChange={set("rt_number")} placeholder="05" />
          </div>
          <div>
            <FieldLabel label="Nomor RW" required />
            <Input value={form.rw_number} onChange={set("rw_number")} placeholder="02" />
          </div>
        </div>

        <div>
          <FieldLabel label="Kelurahan / Desa" required />
          <Input value={form.kelurahan} onChange={set("kelurahan")} placeholder="Padang Harapan" />
        </div>

        <div>
          <FieldLabel label="Kecamatan" required />
          <Input value={form.kecamatan} onChange={set("kecamatan")} placeholder="Gading Cempaka" />
        </div>

        <div>
          <FieldLabel label="Kota / Kabupaten" required />
          <Input value={form.kota} onChange={set("kota")} placeholder="Bengkulu" />
        </div>

        <div>
          <FieldLabel label="Provinsi" required />
          <Select value={form.provinsi} onChange={set("provinsi")} options={PROVINSI_LIST} />
        </div>

        <div>
          <FieldLabel label="Iuran Bulanan (Rp)" required />
          <Input
            type="number"
            value={form.monthly_fee_idr}
            onChange={set("monthly_fee_idr")}
            placeholder="30000"
          />
          <p className="text-xs text-gray-400 mt-1">
            Contoh: 30000 = Rp 30.000/bulan per KK
          </p>
        </div>

        <button
          onClick={handleCreate}
          disabled={saving}
          className="w-full bg-blue-900 text-white py-3 rounded-lg font-bold text-sm
            hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Menyimpan..." : "Buat RT Sekarang"}
        </button>
      </div>
    </div>
  );
}

// ── Settings Form ─────────────────────────────────────────────────────────────

function SettingsForm({ rt, onSaved }: { rt: RTGroup; onSaved: (rt: RTGroup) => void }) {
  const [form, setForm]     = useState<FormState>(rtToForm(rt));
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty]   = useState(false);

  const set = (k: keyof FormState) => (v: string) => {
    setForm(prev => ({ ...prev, [k]: v }));
    setDirty(true);
  };

  // Reset dirty when rt prop changes (after save)
  useEffect(() => {
    setForm(rtToForm(rt));
    setDirty(false);
  }, [rt]);

  async function handleSave() {
    if (!form.rt_number || !form.rw_number || !form.kelurahan || !form.kecamatan || !form.kota) {
      toast.error("Lengkapi semua field wajib");
      return;
    }
    const fee = Number(form.monthly_fee_idr);
    if (isNaN(fee) || fee < 0) {
      toast.error("Iuran bulanan tidak valid");
      return;
    }

    setSaving(true);
    try {
      const updated = await updateRTGroupClient(rt.id, {
        rt_number:       form.rt_number,
        rw_number:       form.rw_number,
        kelurahan:       form.kelurahan,
        kecamatan:       form.kecamatan,
        kota:            form.kota,
        provinsi:        form.provinsi,
        monthly_fee_idr: fee,
      });
      toast.success("✅ Pengaturan RT berhasil disimpan");
      onSaved(updated);
    } catch (err) {
      toast.error(extractApiError(err));
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setForm(rtToForm(rt));
    setDirty(false);
  }

  return (
    <div className="space-y-6">

      {/* Info card — RT identity */}
      <div className="bg-blue-900 text-white rounded-2xl p-5 flex items-center gap-4">
        <div className="w-14 h-14 bg-yellow-400 rounded-xl flex items-center justify-center
          font-extrabold text-blue-900 text-lg flex-shrink-0">
          RT
        </div>
        <div>
          <div className="font-bold text-lg">{rt.display_name}</div>
          <div className="text-blue-200 text-sm">{rt.kelurahan}, {rt.kecamatan}</div>
          <div className="text-blue-200 text-sm">{rt.kota}, {rt.provinsi}</div>
        </div>
      </div>

      {/* Form sections */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

        {/* Section: Identitas RT */}
        <div className="border-b border-gray-100 px-6 py-4 bg-gray-50">
          <h3 className="font-bold text-gray-800 text-sm">📍 Identitas RT</h3>
          <p className="text-xs text-gray-500 mt-0.5">Nomor dan nama wilayah RT Anda</p>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel label="Nomor RT" required />
              <Input value={form.rt_number} onChange={set("rt_number")} placeholder="05" />
            </div>
            <div>
              <FieldLabel label="Nomor RW" required />
              <Input value={form.rw_number} onChange={set("rw_number")} placeholder="02" />
            </div>
          </div>

          <div>
            <FieldLabel label="Kelurahan / Desa" required />
            <Input value={form.kelurahan} onChange={set("kelurahan")} placeholder="Padang Harapan" />
          </div>

          <div>
            <FieldLabel label="Kecamatan" required />
            <Input value={form.kecamatan} onChange={set("kecamatan")} placeholder="Gading Cempaka" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel label="Kota / Kabupaten" required />
              <Input value={form.kota} onChange={set("kota")} placeholder="Bengkulu" />
            </div>
            <div>
              <FieldLabel label="Provinsi" required />
              <Select value={form.provinsi} onChange={set("provinsi")} options={PROVINSI_LIST} />
            </div>
          </div>
        </div>

        {/* Section: Keuangan */}
        <div className="border-t border-b border-gray-100 px-6 py-4 bg-gray-50">
          <h3 className="font-bold text-gray-800 text-sm">💰 Keuangan</h3>
          <p className="text-xs text-gray-500 mt-0.5">Iuran wajib bulanan per KK</p>
        </div>
        <div className="p-6">
          <FieldLabel label="Iuran Bulanan (Rp)" required />
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">
              Rp
            </span>
            <input
              type="number"
              value={form.monthly_fee_idr}
              onChange={e => set("monthly_fee_idr")(e.target.value)}
              placeholder="30000"
              min={0}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 text-sm
                bg-white text-gray-900 hover:border-blue-400 focus:border-blue-500
                focus:ring-2 focus:ring-blue-100 outline-none transition-colors"
            />
          </div>
          {form.monthly_fee_idr && !isNaN(Number(form.monthly_fee_idr)) && (
            <p className="text-xs text-gray-400 mt-1.5">
              = {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 })
                  .format(Number(form.monthly_fee_idr))} per KK per bulan
            </p>
          )}
        </div>

        {/* Section: Info Sistem (readonly) */}
        <div className="border-t border-gray-100 px-6 py-4 bg-gray-50">
          <h3 className="font-bold text-gray-800 text-sm">🔐 Info Sistem</h3>
          <p className="text-xs text-gray-500 mt-0.5">Data yang tidak dapat diubah</p>
        </div>
        <div className="p-6">
          <FieldLabel label="ID Unik RT Group" />
          <Input value={rt.id} readOnly />
          <p className="text-xs text-gray-400 mt-1">
            Gunakan ID ini saat mendaftar sebagai warga
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="flex-1 bg-blue-900 text-white py-3 rounded-xl font-bold text-sm
            hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Menyimpan...
            </>
          ) : "💾 Simpan Perubahan"}
        </button>

        {dirty && (
          <button
            onClick={handleReset}
            className="px-6 py-3 rounded-xl font-semibold text-sm text-gray-600
              border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            Batalkan
          </button>
        )}
      </div>

      {!dirty && (
        <p className="text-xs text-center text-gray-400">
          Ubah salah satu field untuk mengaktifkan tombol simpan
        </p>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function PengaturanPage() {
  const { data: session, status } = useSession();
  const [pageState, setPageState] = useState<PageState>("loading");
  const [rt, setRt]               = useState<RTGroup | null>(null);
  const [error, setError]         = useState<string>("");

  const loadRT = useCallback(async () => {
    const rtGroupId = session?.user?.rt_group_id;

    if (!rtGroupId) {
      setPageState("no-rt");
      return;
    }

    setPageState("loading");
    try {
      const data = await getRTGroupClient(rtGroupId);
      setRt(data);
      setPageState("ready");
    } catch (err) {
      setError(extractApiError(err));
      setPageState("error");
    }
  }, [session?.user?.rt_group_id]);

  useEffect(() => {
    if (status === "authenticated") loadRT();
  }, [status, loadRT]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-xl">
              ⚙️
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Pengaturan RT</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Kelola informasi dan konfigurasi RT Anda
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Page content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">

        {pageState === "loading" && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <Skeleton />
          </div>
        )}

        {pageState === "error" && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
            <div className="text-4xl mb-3">😕</div>
            <div className="font-bold text-red-800 mb-1">Gagal memuat data RT</div>
            <div className="text-red-600 text-sm mb-4">{error}</div>
            <button
              onClick={loadRT}
              className="bg-red-700 text-white px-6 py-2.5 rounded-lg font-semibold text-sm
                hover:bg-red-600 transition-colors"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {pageState === "no-rt" && (
          <NoRTBanner
            onCreated={(newRt) => {
              setRt(newRt);
              setPageState("ready");
            }}
          />
        )}

        {pageState === "ready" && rt && (
          <SettingsForm
            rt={rt}
            onSaved={(updated) => setRt(updated)}
          />
        )}
      </div>
    </div>
  );
}
