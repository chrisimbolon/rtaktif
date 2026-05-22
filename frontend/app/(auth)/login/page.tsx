// app/(auth)/login/page.tsx — replace your current login page
"use client";
import { useAuth } from "@/lib/hooks/useAuth";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Loader2, LogIn } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";

const schema = z.object({
  email:    z.string().email("Email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter"),
});
type FormData = z.infer<typeof schema>;

const AUTH_ERRORS: Record<string, string> = {
  CredentialsSignin:  "Email atau password salah. Silakan coba lagi.",
  AccountPending:     "Akun Anda masih menunggu verifikasi admin RT.",
  AccountSuspended:   "Akun Anda telah disuspend. Hubungi admin RT.",
  Default:            "Terjadi kesalahan. Silakan coba lagi.",
};

export default function LoginPage() {
  const { loginMutation }  = useAuth();
  const searchParams       = useSearchParams();
  const errorCode          = searchParams.get("error") ?? "";
  const serverError        = AUTH_ERRORS[errorCode] ?? (errorCode ? AUTH_ERRORS.Default : "");

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const hasError = serverError || loginMutation.isError;
  const errorMsg = serverError || (loginMutation.error as Error)?.message;

  return (
    <div className="bg-cream-50 rounded-2xl border border-cream-300 shadow-card overflow-hidden animate-slide-up">
      {/* Brand header */}
      <div className="bg-forest-800 px-8 py-7 batik-overlay">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-terra-500 flex items-center justify-center flex-shrink-0">
            <span className="font-display font-black text-white">RT</span>
          </div>
          <span className="font-display font-bold text-cream-100 text-xl">RukunRT</span>
        </div>
        <p className="text-forest-200 text-sm">Sistem Manajemen RT/RW Digital</p>
      </div>

      <div className="px-8 py-7">
        <h2 className="font-display font-bold text-2xl text-charcoal-950 mb-1">Masuk</h2>
        <p className="text-sm text-charcoal-400 mb-6">Selamat datang kembali 👋</p>

        {/* Error banner */}
        {hasError && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-5">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{errorMsg}</p>
          </div>
        )}

        {/* Pending notice after register */}
        {searchParams.get("registered") === "1" && (
          <div className="bg-forest-50 border border-forest-200 rounded-xl px-4 py-3 mb-5">
            <p className="text-sm text-forest-700">
              ✅ Pendaftaran berhasil! Akun Anda sedang menunggu verifikasi admin RT.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit((d) => loginMutation.mutate(d))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-charcoal-700 mb-1.5">Email</label>
            <input
              {...register("email")}
              type="email"
              autoComplete="email"
              placeholder="admin@rukunrt.id"
              className="w-full px-4 py-2.5 rounded-lg border border-cream-300 bg-cream-100 text-charcoal-900 placeholder:text-charcoal-400 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500/30 focus:border-forest-500 transition"
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-charcoal-700">Password</label>
            </div>
            <input
              {...register("password")}
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full px-4 py-2.5 rounded-lg border border-cream-300 bg-cream-100 text-charcoal-900 placeholder:text-charcoal-400 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500/30 focus:border-forest-500 transition"
            />
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
          </div>

          <button
            type="submit"
            disabled={loginMutation.isPending}
            className="w-full flex items-center justify-center gap-2 bg-forest-700 hover:bg-forest-600 text-cream-50 font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60"
          >
            {loginMutation.isPending
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Masuk...</>
              : <><LogIn className="w-4 h-4" /> Masuk</>
            }
          </button>
        </form>

        <p className="text-center text-sm text-charcoal-400 mt-6">
          Belum punya akun?{" "}
          <Link href="/register" className="text-forest-600 hover:text-forest-700 font-medium">
            Daftar di sini
          </Link>
        </p>
      </div>
    </div>
  );
}
