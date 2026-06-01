"use client";

/**
 * /app/(auth)/register/page.tsx
 *
 * Multi-path registration:
 *   Path A — Warga      : name + email + phone + password + RT selector  (existing flow, preserved)
 *   Path B — Ketua RT   : name + email + phone + password
 *                         → Step 1: Upload KTP
 *                         → Step 2: Upload SK Pengangkatan
 *                         → Step 3: Pakta Integritas + canvas signature
 *
 * State machine per step:
 *   idle → uploading → success | error
 *
 * Wires to:
 *   POST /auth/register          { full_name, email, phone, password, role, rt_group_id? }
 *   POST /ketua-rt/onboarding    { ktp_url, sk_url, signature_data, rt_identity }
 *     (multipart for files — see lib/api/onboarding.ts)
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { authApi } from "@/lib/api/auth"
import { listRTGroups } from "@/lib/api/rtgroup";
import { onboardingApi } from "@/lib/api/onboarding";
import { cn } from "@/lib/utils";

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const baseSchema = z.object({
  full_name: z.string().min(3, "Nama minimal 3 karakter"),
  email:     z.string().email("Format email tidak valid"),
  phone:     z
    .string()
    .regex(/^(\+62|62|0)[0-9]{8,13}$/, "Format nomor HP tidak valid (cth: 08123456789)"),
  password:  z.string().min(6, "Password minimal 6 karakter"),
  role:      z.enum(["warga", "ketua_rt"]),
});

const wargaSchema = baseSchema.extend({
  role:        z.literal("warga"),
  rt_group_id: z.string().uuid("Pilih RT terlebih dahulu"),
});

const ketuaSchema = baseSchema.extend({
  role: z.literal("ketua_rt"),
  // RT identity — collected in onboarding step, not base form
  rt_number: z.string().regex(/^\d{1,3}$/, "1–3 digit"),
  rw_number: z.string().regex(/^\d{1,3}$/, "1–3 digit"),
  kelurahan: z.string().min(2, "Wajib diisi"),
  kecamatan: z.string().min(2, "Wajib diisi"),
  kota:      z.string().min(2, "Wajib diisi"),
});

const registerSchema = z.discriminatedUnion("role", [wargaSchema, ketuaSchema]);
type RegisterFormValues = z.infer<typeof registerSchema>;

// ─── Upload state machine ──────────────────────────────────────────────────────

type UploadState = "idle" | "uploading" | "success" | "error";

interface UploadFile {
  state:    UploadState;
  file:     File | null;
  preview:  string | null;   // object URL for images
  url:      string | null;   // returned by upload API
  error:    string | null;
}

const emptyUpload = (): UploadFile => ({
  state: "idle", file: null, preview: null, url: null, error: null,
});

// ─── Onboarding step type ─────────────────────────────────────────────────────

type OnboardingStep = 1 | 2 | 3;

// ═══════════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════════

export default function RegisterPage() {
  const router = useRouter();

  // ── Base form ────────────────────────────────────────────────────────────
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: "warga" },
  });

  const role = watch("role");

  // ── Warga: RT group list ─────────────────────────────────────────────────
  const { data: rtGroups = [] } = useQuery({
    queryKey: ["rt-groups"],
    queryFn:  listRTGroups,
    enabled:  role === "warga",
  });

  // ── Ketua RT: onboarding state ───────────────────────────────────────────
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>(1);
  const [ktpUpload, setKtpUpload]           = useState<UploadFile>(emptyUpload);
  const [skUpload,  setSkUpload]            = useState<UploadFile>(emptyUpload);
  const [hasSig,    setHasSig]              = useState(false);
  const [agreed,    setAgreed]              = useState(false);
  const [registeredUserId, setRegisteredUserId] = useState<string | null>(null);

  // ── Canvas signature ──────────────────────────────────────────────────────
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const isDrawing   = useRef(false);
  const lastPos     = useRef({ x: 0, y: 0 });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const registerMutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: (data) => {
      if (role === "ketua_rt") {
        setRegisteredUserId(data.id);
        // Stay on page — show onboarding steps
      } else {
        toast.success("Pendaftaran berhasil! Menunggu verifikasi admin.");
        router.push("/login?registered=1");
      }
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail ?? "Pendaftaran gagal. Coba lagi.";
      toast.error(msg);
    },
  });

  const onboardingMutation = useMutation({
    mutationFn: onboardingApi.submitVerification,
    onSuccess: () => {
      toast.success("Dokumen terkirim! Tim kami akan meninjau dalam 1×24 jam.");
      router.push("/login?registered=1&ketua=1");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? "Gagal mengirim dokumen. Coba lagi.");
    },
  });

  // ── Base form submit ──────────────────────────────────────────────────────
  const onSubmit = handleSubmit((data) => {
    registerMutation.mutate(data);
  });

  // ── File upload handlers ──────────────────────────────────────────────────
  const handleFileUpload = useCallback(
    async (
      file: File,
      setter: React.Dispatch<React.SetStateAction<UploadFile>>,
      type: "ktp" | "sk",
    ) => {
      const preview = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
      setter({ state: "uploading", file, preview, url: null, error: null });

      try {
        const { url } = await onboardingApi.uploadDocument(file, type);
        setter((prev) => ({ ...prev, state: "success", url }));
        toast.success(`${type === "ktp" ? "KTP" : "SK"} berhasil diunggah`);
      } catch {
        setter((prev) => ({ ...prev, state: "error", error: "Upload gagal. Coba lagi." }));
        toast.error("Upload gagal. Periksa koneksi Anda.");
      }
    },
    [],
  );

  // ── Canvas: pointer/touch drawing ─────────────────────────────────────────
  const getCanvasPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top)  * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top)  * scaleY,
    };
  };

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    isDrawing.current = true;
    const pos = getCanvasPos(e, canvas);
    lastPos.current = pos;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 1.2, 0, Math.PI * 2);
    ctx.fillStyle = "#1a1a2e";
    ctx.fill();
    setHasSig(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    e.preventDefault();
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const pos = getCanvasPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#1a1a2e";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    lastPos.current = pos;
  };

  const stopDraw = () => { isDrawing.current = false; };

  const clearSignature = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setHasSig(false);
  };

  // ── Final onboarding submit ───────────────────────────────────────────────
  const submitOnboarding = () => {
    if (!registeredUserId || !ktpUpload.url || !skUpload.url) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const signatureData = canvas.toDataURL("image/png");

    const formValues = watch() as z.infer<typeof ketuaSchema>;

    onboardingMutation.mutate({
      user_id:        registeredUserId,
      ktp_url:        ktpUpload.url,
      sk_url:         skUpload.url,
      signature_data: signatureData,
      rt_number:      formValues.rt_number,
      rw_number:      formValues.rw_number,
      kelurahan:      formValues.kelurahan,
      kecamatan:      formValues.kecamatan,
      kota:           formValues.kota,
    });
  };

  // ── Cleanup object URLs on unmount ────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (ktpUpload.preview) URL.revokeObjectURL(ktpUpload.preview);
      if (skUpload.preview)  URL.revokeObjectURL(skUpload.preview);
    };
  }, [ktpUpload.preview, skUpload.preview]);

  // ── Progress helpers ──────────────────────────────────────────────────────
  const progressSteps: OnboardingStep[] = [1, 2, 3];
  const stepLabels = ["Unggah KTP", "SK Pengangkatan", "Tanda Tangan"];

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: Ketua RT onboarding (after base registration)
  // ─────────────────────────────────────────────────────────────────────────

  if (role === "ketua_rt" && registeredUserId) {
    const formValues = watch() as z.infer<typeof ketuaSchema>;
    const step1Done  = ktpUpload.state  === "success";
    const step2Done  = skUpload.state   === "success";
    const step3Done  = hasSig && agreed;
    const canProceed = [step1Done, step2Done, step3Done][onboardingStep - 1];
    const isLastStep = onboardingStep === 3;

    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">

          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center">
                <span className="text-white text-xs font-bold">RT</span>
              </div>
              <span className="text-white font-semibold text-sm">RTMudah</span>
            </div>
            <h1 className="text-white text-xl font-semibold">Verifikasi Ketua RT</h1>
            <p className="text-gray-400 text-sm mt-1">
              Lengkapi dokumen untuk mengaktifkan akun Anda
            </p>
          </div>

          {/* Progress */}
          <div className="mb-6">
            <div className="flex gap-2 mb-3">
              {progressSteps.map((s) => (
                <div
                  key={s}
                  className={cn(
                    "flex-1 h-1 rounded-full transition-all duration-500",
                    s < onboardingStep  ? "bg-green-500" :
                    s === onboardingStep ? "bg-orange-500" :
                    "bg-gray-800"
                  )}
                />
              ))}
            </div>
            <div className="flex justify-between">
              {stepLabels.map((label, i) => (
                <span
                  key={label}
                  className={cn(
                    "text-xs transition-colors",
                    i + 1 < onboardingStep  ? "text-green-500" :
                    i + 1 === onboardingStep ? "text-orange-400" :
                    "text-gray-600"
                  )}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* ── Step 1: KTP Upload ── */}
          {onboardingStep === 1 && (
            <OnboardingCard
              stepNum={1}
              title="Unggah KTP"
              upload={ktpUpload}
              onFile={(f) => handleFileUpload(f, setKtpUpload, "ktp")}
              accept="image/*,.pdf"
              icon="🪪"
              placeholder="Ketuk untuk unggah foto KTP Anda"
              previewContent={
                ktpUpload.state === "success" && (
                  <KTPPreview
                    name={formValues.full_name}
                    preview={ktpUpload.preview}
                  />
                )
              }
            />
          )}

          {/* ── Step 2: SK Upload ── */}
          {onboardingStep === 2 && (
            <OnboardingCard
              stepNum={2}
              title="Unggah SK Pengangkatan"
              upload={skUpload}
              onFile={(f) => handleFileUpload(f, setSkUpload, "sk")}
              accept="image/*,.pdf"
              icon="📄"
              placeholder="Surat Keputusan Ketua RT dari Kelurahan"
              previewContent={
                skUpload.state === "success" && (
                  <div className="flex items-center gap-3 p-3 bg-green-950/50 border border-green-800/50 rounded-xl mt-3">
                    <span className="text-2xl">✅</span>
                    <div>
                      <p className="text-green-400 text-xs font-medium">
                        {skUpload.file?.name ?? "SK_Pengangkatan.pdf"}
                      </p>
                      <p className="text-green-600 text-xs">
                        {skUpload.file ? `${(skUpload.file.size / 1024).toFixed(0)} KB` : ""} — berhasil diunggah
                      </p>
                    </div>
                  </div>
                )
              }
            />
          )}

          {/* ── Step 3: Pakta Integritas + Signature ── */}
          {onboardingStep === 3 && (
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">3</div>
                <h3 className="text-white text-sm font-medium">Pernyataan Hukum & Tanda Tangan</h3>
              </div>

              {/* Pakta text */}
              <div className="bg-gray-950 rounded-xl p-4 border border-gray-800">
                <p className="text-gray-400 text-xs leading-relaxed">
                  Dengan ini saya,{" "}
                  <strong className="text-gray-200">{formValues.full_name?.toUpperCase()}</strong>,
                  Ketua RT{" "}
                  <strong className="text-gray-200">{formValues.rt_number}</strong> / RW{" "}
                  <strong className="text-gray-200">{formValues.rw_number}</strong>, Kelurahan{" "}
                  <strong className="text-gray-200">{formValues.kelurahan}</strong>, Kecamatan{" "}
                  <strong className="text-gray-200">{formValues.kecamatan}</strong>,{" "}
                  <strong className="text-gray-200">{formValues.kota}</strong>, menyatakan bahwa
                  seluruh data dan dokumen yang saya unggah adalah benar, asli, dan akurat.
                  Saya memegang penuh tanggung jawab hukum atas keaslian informasi ini.
                  Saya menyetujui bahwa tanda tangan digital ini memiliki kekuatan hukum yang sah.{" "}
                  <span className="text-orange-400">(Pasal 242 KUHP & UU ITE)</span>
                </p>
              </div>

              {/* Canvas */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-xs">Tanda tangan di sini</span>
                  {hasSig && (
                    <button
                      type="button"
                      onClick={clearSignature}
                      className="text-orange-400 text-xs hover:text-orange-300 transition-colors"
                    >
                      Ulangi Tanda Tangan
                    </button>
                  )}
                </div>
                <div className="relative rounded-xl overflow-hidden border border-gray-700 bg-white">
                  <canvas
                    ref={canvasRef}
                    width={400}
                    height={100}
                    className="w-full h-[100px] cursor-crosshair touch-none block"
                    onMouseDown={startDraw}
                    onMouseMove={draw}
                    onMouseUp={stopDraw}
                    onMouseLeave={stopDraw}
                    onTouchStart={startDraw}
                    onTouchMove={draw}
                    onTouchEnd={stopDraw}
                    aria-label="Area tanda tangan digital"
                  />
                  {!hasSig && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="text-gray-400 text-sm">Ketuk di sini untuk Tanda Tangan</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Checkbox */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-orange-500 flex-shrink-0"
                />
                <span className="text-gray-400 text-xs leading-relaxed">
                  Saya menyetujui{" "}
                  <span className="text-orange-400">Pakta Integritas</span> dan memberikan
                  persetujuan secara sadar tanpa paksaan
                </span>
              </label>
            </div>
          )}

          {/* CTA button */}
          <button
            type="button"
            disabled={!canProceed || onboardingMutation.isPending}
            onClick={() => {
              if (!isLastStep) {
                setOnboardingStep((s) => (s + 1) as OnboardingStep);
              } else {
                submitOnboarding();
              }
            }}
            className={cn(
              "mt-4 w-full py-3.5 rounded-2xl font-medium text-sm transition-all duration-200",
              canProceed && !onboardingMutation.isPending
                ? "bg-orange-500 text-white hover:bg-orange-400 active:scale-[0.98]"
                : "bg-gray-800 text-gray-600 cursor-not-allowed"
            )}
          >
            {onboardingMutation.isPending
              ? "Mengirim..."
              : isLastStep
              ? "Kirim & Aktivasi Akun"
              : `Lanjut ke ${stepLabels[onboardingStep]}`}
          </button>

          {/* Back step */}
          {onboardingStep > 1 && !onboardingMutation.isPending && (
            <button
              type="button"
              onClick={() => setOnboardingStep((s) => (s - 1) as OnboardingStep)}
              className="mt-2 w-full py-2.5 text-gray-500 text-sm hover:text-gray-300 transition-colors"
            >
              ← Kembali
            </button>
          )}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: Base registration form
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center">
              <span className="text-white text-xs font-bold">RT</span>
            </div>
            <span className="text-white font-semibold text-sm">RTMudah</span>
          </div>
          <h1 className="text-white text-2xl font-semibold">Daftar Akun</h1>
          <p className="text-gray-400 text-sm mt-1">
            Sudah punya akun?{" "}
            <Link href="/login" className="text-orange-400 hover:text-orange-300 transition-colors">
              Masuk di sini
            </Link>
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">

          {/* Role picker */}
          <div className="grid grid-cols-2 gap-3">
            {(["warga", "ketua_rt"] as const).map((r) => (
              <label
                key={r}
                className={cn(
                  "flex flex-col gap-1 p-4 rounded-2xl border cursor-pointer transition-all",
                  role === r
                    ? "border-orange-500 bg-orange-500/10"
                    : "border-gray-800 bg-gray-900 hover:border-gray-700"
                )}
              >
                <input
                  type="radio"
                  value={r}
                  className="sr-only"
                  {...register("role")}
                />
                <span className="text-xl">{r === "warga" ? "🏠" : "👤"}</span>
                <span className={cn(
                  "font-medium text-sm",
                  role === r ? "text-orange-400" : "text-gray-300"
                )}>
                  {r === "warga" ? "Warga" : "Ketua RT"}
                </span>
                <span className="text-xs text-gray-500">
                  {r === "warga" ? "Anggota warga RT" : "Pengurus RT aktif"}
                </span>
              </label>
            ))}
          </div>

          {/* Full name */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Nama Lengkap</label>
            <input
              type="text"
              placeholder="Sesuai KTP"
              className={cn(
                "w-full px-4 py-3 rounded-xl bg-gray-900 border text-white text-sm placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all",
                errors.full_name ? "border-red-500" : "border-gray-800 focus:border-orange-500"
              )}
              {...register("full_name")}
            />
            {errors.full_name && (
              <p className="text-red-400 text-xs mt-1">{errors.full_name.message}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Email</label>
            <input
              type="email"
              placeholder="nama@email.com"
              className={cn(
                "w-full px-4 py-3 rounded-xl bg-gray-900 border text-white text-sm placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all",
                errors.email ? "border-red-500" : "border-gray-800 focus:border-orange-500"
              )}
              {...register("email")}
            />
            {errors.email && (
              <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>
            )}
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Nomor HP (WhatsApp)</label>
            <input
              type="tel"
              placeholder="08123456789"
              className={cn(
                "w-full px-4 py-3 rounded-xl bg-gray-900 border text-white text-sm placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all",
                errors.phone ? "border-red-500" : "border-gray-800 focus:border-orange-500"
              )}
              {...register("phone")}
            />
            {errors.phone && (
              <p className="text-red-400 text-xs mt-1">{errors.phone.message}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Password</label>
            <input
              type="password"
              placeholder="Minimal 6 karakter"
              className={cn(
                "w-full px-4 py-3 rounded-xl bg-gray-900 border text-white text-sm placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all",
                errors.password ? "border-red-500" : "border-gray-800 focus:border-orange-500"
              )}
              {...register("password")}
            />
            {errors.password && (
              <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>
            )}
          </div>

          {/* Warga: RT selector */}
          {role === "warga" && (
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Pilih RT Anda</label>
              <select
                className={cn(
                  "w-full px-4 py-3 rounded-xl bg-gray-900 border text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all appearance-none",
                  (errors as any).rt_group_id ? "border-red-500 text-red-400" : "border-gray-800 text-white focus:border-orange-500"
                )}
                {...register("rt_group_id")}
                defaultValue=""
              >
                <option value="" disabled className="text-gray-600">
                  {rtGroups.length === 0 ? "Memuat daftar RT..." : "— Pilih RT —"}
                </option>
                {rtGroups.map((rt: any) => (
                  <option key={rt.id} value={rt.id} className="bg-gray-900 text-white">
                    {rt.display_name}
                  </option>
                ))}
                {rtGroups.length === 0 && (
                  <option disabled className="text-gray-500">
                    Belum ada RT terdaftar. Hubungi administrator.
                  </option>
                )}
              </select>
              {(errors as any).rt_group_id && (
                <p className="text-red-400 text-xs mt-1">{(errors as any).rt_group_id?.message}</p>
              )}
            </div>
          )}

          {/* Ketua RT: RT identity fields */}
          {role === "ketua_rt" && (
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4 space-y-3">
              <p className="text-xs text-gray-400 font-medium">Identitas Wilayah RT</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Nomor RT</label>
                  <input
                    type="text"
                    placeholder="005"
                    maxLength={3}
                    className="w-full px-3 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-all"
                    {...register("rt_number")}
                  />
                  {(errors as any).rt_number && (
                    <p className="text-red-400 text-xs mt-1">{(errors as any).rt_number?.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Nomor RW</label>
                  <input
                    type="text"
                    placeholder="003"
                    maxLength={3}
                    className="w-full px-3 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-all"
                    {...register("rw_number")}
                  />
                  {(errors as any).rw_number && (
                    <p className="text-red-400 text-xs mt-1">{(errors as any).rw_number?.message}</p>
                  )}
                </div>
              </div>
              {(["kelurahan", "kecamatan", "kota"] as const).map((field) => (
                <div key={field}>
                  <label className="block text-xs text-gray-500 mb-1 capitalize">{field}</label>
                  <input
                    type="text"
                    placeholder={
                      field === "kelurahan" ? "Menteng" :
                      field === "kecamatan" ? "Menteng" :
                      "Jakarta Pusat"
                    }
                    className="w-full px-3 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-all"
                    {...register(field)}
                  />
                  {(errors as any)[field] && (
                    <p className="text-red-400 text-xs mt-1">{(errors as any)[field]?.message}</p>
                  )}
                </div>
              ))}
              <p className="text-xs text-gray-600 pt-1">
                Dokumen KTP & SK Pengangkatan akan diminta setelah ini.
              </p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting || registerMutation.isPending}
            className={cn(
              "w-full py-3.5 rounded-2xl font-medium text-sm transition-all duration-200 mt-2",
              isSubmitting || registerMutation.isPending
                ? "bg-gray-800 text-gray-600 cursor-not-allowed"
                : "bg-orange-500 text-white hover:bg-orange-400 active:scale-[0.98]"
            )}
          >
            {registerMutation.isPending
              ? "Mendaftarkan..."
              : role === "ketua_rt"
              ? "Daftar & Lanjut Verifikasi →"
              : "Daftar Sekarang"}
          </button>

        </form>

        <p className="text-center text-xs text-gray-600 mt-6">
          Dengan mendaftar, Anda menyetujui{" "}
          <span className="text-gray-500">Syarat & Ketentuan</span> RTMudah.
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════════════════

interface OnboardingCardProps {
  stepNum:        number;
  title:          string;
  upload:         UploadFile;
  onFile:         (file: File) => void;
  accept:         string;
  icon:           string;
  placeholder:    string;
  previewContent: React.ReactNode;
}

function OnboardingCard({
  stepNum, title, upload, onFile, accept, icon, placeholder, previewContent,
}: OnboardingCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  };

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <div className={cn(
          "w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0",
          upload.state === "success" ? "bg-green-500" : "bg-orange-500"
        )}>
          {upload.state === "success" ? "✓" : stepNum}
        </div>
        <h3 className="text-white text-sm font-medium">{title}</h3>
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className={cn(
          "border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200",
          upload.state === "success"
            ? "border-green-700 bg-green-950/30"
            : upload.state === "uploading"
            ? "border-orange-700 bg-orange-950/20 animate-pulse"
            : upload.state === "error"
            ? "border-red-700 bg-red-950/20"
            : "border-gray-700 hover:border-orange-500 hover:bg-gray-800/50"
        )}
        aria-label={`Upload ${title}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
        />
        <div className="text-3xl mb-2">
          {upload.state === "success" ? "✅" :
           upload.state === "uploading" ? "⏳" :
           upload.state === "error"    ? "❌" : icon}
        </div>
        <p className={cn(
          "text-sm",
          upload.state === "success"   ? "text-green-400" :
          upload.state === "uploading" ? "text-orange-400" :
          upload.state === "error"     ? "text-red-400" :
          "text-gray-400"
        )}>
          {upload.state === "success"   ? `${upload.file?.name ?? "File"} — berhasil diunggah` :
           upload.state === "uploading" ? "Mengunggah..." :
           upload.state === "error"     ? (upload.error ?? "Upload gagal") :
           placeholder}
        </p>
        {upload.state === "idle" && (
          <p className="text-xs text-gray-600 mt-1">atau drag & drop file di sini</p>
        )}
      </div>

      {previewContent}
    </div>
  );
}

function KTPPreview({ name, preview }: { name: string; preview: string | null }) {
  return (
    <div className="bg-blue-950 rounded-xl p-3 border border-blue-900/50 mt-1">
      <p className="text-blue-300 text-xs text-center font-medium mb-2 tracking-wider uppercase">
        Kartu Tanda Penduduk
      </p>
      <div className="flex gap-3 items-start">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="KTP preview" className="w-12 h-14 rounded-md object-cover flex-shrink-0" />
        ) : (
          <div className="w-12 h-14 rounded-md bg-blue-900 flex items-center justify-center flex-shrink-0">
            <span className="text-xl">👤</span>
          </div>
        )}
        <div className="flex-1 space-y-1">
          {[
            ["NIK",  "3173XXXXXXX005"],
            ["Nama", name?.toUpperCase() || "—"],
          ].map(([label, value]) => (
            <div key={label} className="flex gap-2">
              <span className="text-blue-500 text-xs w-8 flex-shrink-0">{label}</span>
              <span className="text-blue-200 text-xs font-medium">{value}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3 p-2 bg-green-950/60 rounded-lg border border-green-800/40">
        <span className="text-green-400 text-xs">✓</span>
        <span className="text-green-400 text-xs font-medium">Dokumen KTP Berhasil Diunggah</span>
      </div>
    </div>
  );
}
