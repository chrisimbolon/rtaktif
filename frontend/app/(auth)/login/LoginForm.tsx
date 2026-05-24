// app/(auth)/login/LoginForm.tsx
// The actual login form — separated so useSearchParams() is in Suspense
"use client";
import { useForm }        from "react-hook-form";
import { zodResolver }    from "@hookform/resolvers/zod";
import { z }              from "zod";
import { useAuth }        from "@/lib/hooks/useAuth";
import { useSearchParams } from "next/navigation";
import Link               from "next/link";
import { Loader2, LogIn, AlertCircle } from "lucide-react";

const schema = z.object({
  email:    z.string().email("Email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter"),
});
type FormData = z.infer<typeof schema>;

const AUTH_ERRORS: Record<string, string> = {
  CredentialsSignin: "Email atau password salah. Silakan coba lagi.",
  AccountPending:    "Akun Anda masih menunggu verifikasi admin RT.",
  AccountSuspended:  "Akun Anda telah disuspend. Hubungi admin RT.",
  Default:           "Terjadi kesalahan. Silakan coba lagi.",
};

export function LoginForm() {
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
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Brand header */}
      <div className="bg-green-800 px-8 py-7">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center flex-shrink-0">
            <span className="font-bold text-white">RT</span>
          </div>
          <span className="font-bold text-white text-xl">RTMudah</span>
        </div>
        <p className="text-green-200 text-sm">Sistem Manajemen RT/RW Digital</p>
      </div>

      <div className="px-8 py-7">
        <h2 className="font-bold text-2xl text-gray-900 mb-1">Masuk</h2>
        <p className="text-sm text-gray-400 mb-6">Selamat datang kembali 👋</p>

        {hasError && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-5">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{errorMsg}</p>
          </div>
        )}

        {searchParams.get("registered") === "1" && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-5">
            <p className="text-sm text-green-700">
              ✅ Pendaftaran berhasil! Akun Anda sedang menunggu verifikasi admin RT.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit((d) => loginMutation.mutate(d))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input
              {...register("email")}
              type="email"
              autoComplete="email"
              placeholder="admin@rtmudah.id"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 transition"
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
            <input
              {...register("password")}
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 transition"
            />
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
          </div>

          <button
            type="submit"
            disabled={loginMutation.isPending}
            className="w-full flex items-center justify-center gap-2 bg-green-700 hover:bg-green-600 text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60"
          >
            {loginMutation.isPending
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Masuk...</>
              : <><LogIn className="w-4 h-4" /> Masuk</>
            }
          </button>
        </form>

        <p className="text-center text-sm text-gray-400 mt-6">
          Belum punya akun?{" "}
          <Link href="/register" className="text-green-600 hover:text-green-700 font-medium">
            Daftar di sini
          </Link>
        </p>
      </div>
    </div>
  );
}
