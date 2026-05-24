"use client";
import { authApi } from "@/lib/api/auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Loader2, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
  full_name: z.string().min(3, "Nama minimal 3 karakter"),
  email:     z.string().email("Email tidak valid"),
  phone:     z.string().min(10, "Nomor HP minimal 10 digit"),
  password:  z.string().min(6, "Password minimal 6 karakter"),
});
type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) => authApi.register(data),
    onSuccess: () => {
      toast.success("Pendaftaran berhasil! Silakan menunggu verifikasi admin.");
      router.push("/login");
    },
  });

  return (
    <div className="bg-cream-50 rounded-2xl border border-cream-300 shadow-card overflow-hidden animate-slide-up">
      <div className="bg-forest-800 px-8 py-6 batik-overlay">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-terra-500 flex items-center justify-center">
            <span className="font-display font-black text-white text-sm">RT</span>
          </div>
          <span className="font-display font-bold text-cream-100 text-lg">RukunRT</span>
        </div>
        <p className="text-forest-200 text-sm">Daftar sebagai warga baru</p>
      </div>

      <div className="px-8 py-6">
        <h2 className="font-display font-bold text-2xl text-charcoal-950 mb-1">Daftar</h2>
        <p className="text-sm text-charcoal-400 mb-5">Isi data diri Anda dengan benar</p>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          {[
            { name: "full_name", label: "Nama Lengkap", placeholder: "Budi Prasetyo", type: "text" },
            { name: "email",     label: "Email",         placeholder: "budi@email.com",  type: "email" },
            { name: "phone",     label: "Nomor HP",      placeholder: "08123456789",     type: "tel" },
            { name: "password",  label: "Password",      placeholder: "••••••••",        type: "password" },
          ].map(({ name, label, placeholder, type }) => (
            <div key={name}>
              <label className="block text-sm font-medium text-charcoal-700 mb-1.5">{label}</label>
              <input
                {...register(name as keyof FormData)}
                type={type}
                placeholder={placeholder}
                className="w-full px-4 py-2.5 rounded-lg border border-cream-300 bg-cream-100 text-charcoal-900 placeholder:text-charcoal-400 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500/30 focus:border-forest-500 transition"
              />
              {errors[name as keyof FormData] && (
                <p className="text-red-500 text-xs mt-1">{errors[name as keyof FormData]?.message}</p>
              )}
            </div>
          ))}

          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full flex items-center justify-center gap-2 bg-forest-700 hover:bg-forest-600 text-cream-50 font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60"
          >
            {mutation.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Mendaftar...</>
            ) : (
              <><UserPlus className="w-4 h-4" /> Daftar Sekarang</>
            )}
          </button>
        </form>

        <p className="text-center text-sm text-charcoal-400 mt-5">
          Sudah punya akun?{" "}
          <Link href="/login" className="text-forest-600 hover:text-forest-700 font-medium">
            Masuk di sini
          </Link>
        </p>
      </div>
    </div>
  );
}
