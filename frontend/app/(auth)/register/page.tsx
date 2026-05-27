"use client";
// app/(auth)/register/page.tsx
// Warga registration with RT group selector
import { authApi } from "@/lib/api/auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronDown, Loader2, MapPin, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

// ── Types ────────────────────────────────────────────────────────────────────

interface RTGroupOption {
  id:           string;
  display_name: string;
  rt_number:    string;
  rw_number:    string;
  kelurahan:    string;
  kecamatan:    string;
  kota:         string;
}

// ── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  full_name:   z.string().min(3,  "Nama minimal 3 karakter"),
  email:       z.string().email("Email tidak valid"),
  phone:       z.string().min(10, "Nomor HP minimal 10 digit"),
  password:    z.string().min(6,  "Password minimal 6 karakter"),
  rt_group_id: z.string().uuid("Pilih RT terlebih dahulu"),
});
type FormData = z.infer<typeof schema>;

// ── Fetch RT groups ───────────────────────────────────────────────────────────

async function fetchRTGroups(): Promise<RTGroupOption[]> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/rt-groups`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("Gagal memuat daftar RT");
  return res.json();
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RegisterPage() {
  const router = useRouter();

  // Fetch RT groups for dropdown
  const { data: rtGroups = [], isLoading: loadingRTs } = useQuery({
    queryKey: ["rt-groups"],
    queryFn:  fetchRTGroups,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const selectedRTId = watch("rt_group_id");
  const selectedRT   = rtGroups.find((rt) => rt.id === selectedRTId);

  const mutation = useMutation({
    mutationFn: (data: FormData) => authApi.register(data),
    onSuccess: () => {
      toast.success("Pendaftaran berhasil! Silakan menunggu verifikasi admin.");
      router.push("/login");
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail ?? "Pendaftaran gagal. Coba lagi.";
      toast.error(msg);
    },
  });

  return (
    <div className="bg-cream-50 rounded-2xl border border-cream-300 shadow-card overflow-hidden animate-slide-up">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="bg-forest-800 px-8 py-6 batik-overlay">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-terra-500 flex items-center justify-center">
            <span className="font-display font-black text-white text-sm">RT</span>
          </div>
          <span className="font-display font-bold text-cream-100 text-lg">RTMudah</span>
        </div>
        <p className="text-forest-200 text-sm">Daftar sebagai warga baru</p>
      </div>

      {/* ── Form ───────────────────────────────────────────────── */}
      <div className="px-8 py-6">
        <h2 className="font-display font-bold text-2xl text-charcoal-950 mb-1">Daftar</h2>
        <p className="text-sm text-charcoal-400 mb-5">Isi data diri Anda dengan benar</p>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">

          {/* Standard fields */}
          {[
            { name: "full_name", label: "Nama Lengkap", placeholder: "Budi Prasetyo", type: "text"     },
            { name: "email",     label: "Email",         placeholder: "budi@email.com", type: "email"   },
            { name: "phone",     label: "Nomor HP",      placeholder: "08123456789",    type: "tel"     },
            { name: "password",  label: "Password",      placeholder: "••••••••",       type: "password"},
          ].map(({ name, label, placeholder, type }) => (
            <div key={name}>
              <label className="block text-sm font-medium text-charcoal-700 mb-1.5">
                {label}
              </label>
              <input
                {...register(name as keyof FormData)}
                type={type}
                placeholder={placeholder}
                className="w-full px-4 py-2.5 rounded-lg border border-cream-300 bg-cream-100
                  text-charcoal-900 placeholder:text-charcoal-400 text-sm focus:outline-none
                  focus:ring-2 focus:ring-forest-500/30 focus:border-forest-500 transition"
              />
              {errors[name as keyof FormData] && (
                <p className="text-red-500 text-xs mt-1">
                  {errors[name as keyof FormData]?.message}
                </p>
              )}
            </div>
          ))}

          {/* ── RT Group Selector ──────────────────────────────── */}
          <div>
            <label className="block text-sm font-medium text-charcoal-700 mb-1.5">
              Pilih RT <span className="text-red-500">*</span>
            </label>

            {loadingRTs ? (
              <div className="w-full px-4 py-2.5 rounded-lg border border-cream-300 bg-cream-100
                text-charcoal-400 text-sm flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Memuat daftar RT...
              </div>
            ) : rtGroups.length === 0 ? (
              <div className="w-full px-4 py-2.5 rounded-lg border border-amber-200
                bg-amber-50 text-amber-700 text-sm">
                Belum ada RT terdaftar. Hubungi administrator.
              </div>
            ) : (
              <div className="relative">
                <select
                  {...register("rt_group_id")}
                  className="w-full px-4 py-2.5 pr-10 rounded-lg border border-cream-300
                    bg-cream-100 text-charcoal-900 text-sm focus:outline-none
                    focus:ring-2 focus:ring-forest-500/30 focus:border-forest-500
                    transition appearance-none cursor-pointer"
                >
                  <option value="">-- Pilih RT Anda --</option>
                  {rtGroups.map((rt) => (
                    <option key={rt.id} value={rt.id}>
                      {rt.display_name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2
                  w-4 h-4 text-charcoal-400 pointer-events-none" />
              </div>
            )}

            {errors.rt_group_id && (
              <p className="text-red-500 text-xs mt-1">{errors.rt_group_id.message}</p>
            )}

            {/* RT detail card — shows when user selects an RT */}
            {selectedRT && (
              <div className="mt-2 px-3 py-2.5 rounded-lg bg-forest-50 border border-forest-200
                flex items-start gap-2">
                <MapPin className="w-4 h-4 text-forest-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-forest-800">
                    {selectedRT.display_name}
                  </p>
                  <p className="text-xs text-forest-600 mt-0.5">
                    {selectedRT.kelurahan}, {selectedRT.kecamatan}, {selectedRT.kota}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── Submit ─────────────────────────────────────────── */}
          <button
            type="submit"
            disabled={mutation.isPending || loadingRTs}
            className="w-full flex items-center justify-center gap-2 bg-forest-700
              hover:bg-forest-600 text-cream-50 font-medium py-2.5 rounded-lg text-sm
              transition-colors disabled:opacity-60"
          >
            {mutation.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Mendaftar...</>
            ) : (
              <><UserPlus className="w-4 h-4" /> Daftar Sekarang</>
            )}
          </button>
        </form>

        {/* Info note */}
        <div className="mt-4 px-3 py-2.5 rounded-lg bg-blue-50 border border-blue-100">
          <p className="text-xs text-blue-700 leading-relaxed">
            ℹ️ Setelah mendaftar, akun Anda perlu diverifikasi oleh admin RT sebelum bisa login.
          </p>
        </div>

        <p className="text-center text-sm text-charcoal-400 mt-4">
          Sudah punya akun?{" "}
          <Link href="/login" className="text-forest-600 hover:text-forest-700 font-medium">
            Masuk di sini
          </Link>
        </p>
      </div>
    </div>
  );
}
