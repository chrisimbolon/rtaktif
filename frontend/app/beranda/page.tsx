"use client";
// app/beranda/page.tsx
// Warga portal — temporary holding page until full warga portal is built
// Prevents 404 when warga logs in and gets redirected from admin layout
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function BerandaPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const user      = session?.user as any;
  const fullName  = user?.full_name ?? user?.name ?? "Warga";
  const rtGroupId = user?.rt_group_id;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 11) return "Selamat pagi";
    if (h < 15) return "Selamat siang";
    if (h < 18) return "Selamat sore";
    return "Selamat malam";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-blue-900 text-white">
        <div className="max-w-lg mx-auto px-4 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center
              justify-center font-extrabold text-blue-900 text-sm">
              RT
            </div>
            <div>
              <div className="font-bold text-sm">RTMudah</div>
              <div className="text-blue-300 text-xs">Portal Warga</div>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-xs text-blue-300 hover:text-white transition-colors"
          >
            Keluar
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-5">

        {/* Greeting card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <p className="text-sm text-gray-500">{greeting()},</p>
          <h1 className="text-xl font-bold text-gray-900 mt-0.5">{fullName} 👋</h1>

          {rtGroupId ? (
            <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-3
              flex items-center gap-2.5">
              <div className="w-8 h-8 bg-green-700 rounded-lg flex items-center
                justify-center text-white text-xs font-bold flex-shrink-0">✓</div>
              <div>
                <p className="text-xs font-semibold text-green-800">Akun Terverifikasi</p>
                <p className="text-xs text-green-600 mt-0.5">
                  Anda terdaftar sebagai warga RT
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3
              flex items-center gap-2.5">
              <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center
                justify-center text-white text-xs font-bold flex-shrink-0">!</div>
              <div>
                <p className="text-xs font-semibold text-amber-800">Belum Terdaftar di RT</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Hubungi admin RT untuk verifikasi
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Coming soon features */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-900 text-sm">Fitur Warga</h2>
            <p className="text-xs text-gray-500 mt-0.5">Segera hadir untuk Anda</p>
          </div>
          {[
            { icon: "💳", label: "Tagihan Iuran",     desc: "Lihat & bayar tagihan bulanan",   soon: true  },
            { icon: "📢", label: "Pengumuman RT",      desc: "Info terbaru dari pengurus RT",   soon: true  },
            { icon: "📋", label: "Laporan Masalah",    desc: "Laporkan masalah lingkungan",     soon: true  },
            { icon: "👤", label: "Profil Saya",        desc: "Update data diri dan kontak",     soon: true  },
          ].map((f) => (
            <div key={f.label} className="px-5 py-4 flex items-center gap-4
              border-b border-gray-50 last:border-0">
              <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center
                justify-center text-xl flex-shrink-0">
                {f.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800">{f.label}</p>
                <p className="text-xs text-gray-500">{f.desc}</p>
              </div>
              {f.soon && (
                <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1
                  rounded-full font-medium flex-shrink-0">
                  Segera
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Contact admin */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 text-center">
          <p className="text-sm font-semibold text-blue-900 mb-1">Ada pertanyaan?</p>
          <p className="text-xs text-blue-700 mb-3">
            Hubungi pengurus RT Anda untuk bantuan lebih lanjut
          </p>
          <a
            href="https://wa.me/6281234567890"
            className="inline-flex items-center gap-2 bg-blue-900 text-white
              px-4 py-2 rounded-lg text-xs font-semibold hover:bg-blue-800
              transition-colors"
          >
            💬 Chat WhatsApp
          </a>
        </div>

      </div>
    </div>
  );
}
