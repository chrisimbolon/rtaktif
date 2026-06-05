"use client";
// app/beranda/page.tsx
// Warga portal — shows real announcements + quick links + laporan
import { komunikasiApi } from "@/lib/api/komunikasi";
import type { Announcement } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Calendar, ChevronRight, Info, Megaphone } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

// ── Helpers ───────────────────────────────────────────────────────────────────

const ANN_CONFIG = {
  info:   { icon: Info,          color: "bg-blue-50  border-blue-200  text-blue-700",  border: "border-l-blue-500"  },
  urgent: { icon: AlertTriangle, color: "bg-red-50   border-red-200   text-red-700",   border: "border-l-red-500"   },
  event:  { icon: Calendar,      color: "bg-green-50 border-green-200 text-green-700", border: "border-l-green-500" },
} as const;

function AnnouncementPreview({ ann }: { ann: Announcement }) {
  const cfg  = ANN_CONFIG[ann.ann_type as keyof typeof ANN_CONFIG] ?? ANN_CONFIG.info;
  const Icon = cfg.icon;

  return (
    <div className={`bg-white rounded-xl border border-gray-200 border-l-4
      ${cfg.border} p-4`}>
      <div className="flex items-start gap-3">
        <div className={`p-1.5 rounded-lg border flex-shrink-0 ${cfg.color}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 truncate">{ann.title}</p>
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
            {ann.body}
          </p>
          <p className="text-[10px] text-gray-400 mt-1.5">
            {ann.created_at
              ? new Date(ann.created_at).toLocaleDateString("id-ID", {
                  day: "numeric", month: "long", year: "numeric",
                })
              : "—"
            }
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function BerandaPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  const user      = session?.user as any;
  const fullName  = user?.full_name ?? user?.name ?? "Warga";
  const rtGroupId = user?.rt_group_id;

  // Fetch latest announcements
  const { data: announcements = [] } = useQuery({
    queryKey:  ["announcements", rtGroupId],
    queryFn:   () => komunikasiApi.announcements.list(rtGroupId!),
    enabled:   !!rtGroupId,
    staleTime: 2 * 60 * 1000,
  });

  const latestAnn  = announcements.slice(0, 2);
  const totalAnn   = announcements.length;
  const hasUrgent  = announcements.some(a => a.ann_type === "urgent");

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 11) return "Selamat pagi";
    if (h < 15) return "Selamat siang";
    if (h < 18) return "Selamat sore";
    return "Selamat malam";
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

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="bg-blue-900 text-white">
        <div className="max-w-lg mx-auto px-4 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center
              justify-center font-extrabold text-blue-900 text-sm flex-shrink-0">
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

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* ── Greeting card ──────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <p className="text-sm text-gray-500">{greeting()},</p>
          <h1 className="text-xl font-extrabold text-gray-900 mt-0.5">
            {fullName} 👋
          </h1>

          {rtGroupId ? (
            <div className="mt-3 bg-green-50 border border-green-200 rounded-xl
              p-3 flex items-center gap-2.5">
              <div className="w-7 h-7 bg-green-700 rounded-lg flex items-center
                justify-center text-white text-xs font-bold flex-shrink-0">✓</div>
              <div>
                <p className="text-xs font-semibold text-green-800">Akun Terverifikasi</p>
                <p className="text-xs text-green-600 mt-0.5">
                  Anda terdaftar sebagai warga RT
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl
              p-3 flex items-center gap-2.5">
              <div className="w-7 h-7 bg-amber-500 rounded-lg flex items-center
                justify-center text-white text-xs font-bold flex-shrink-0">!</div>
              <div>
                <p className="text-xs font-semibold text-amber-800">
                  Menunggu Verifikasi
                </p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Hubungi Ketua RT untuk verifikasi akun
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Urgent banner ──────────────────────────────────────── */}
        {hasUrgent && (
          <div className="bg-red-600 text-white rounded-2xl p-4 flex
            items-center gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold">Ada Pengumuman Mendesak!</p>
              <p className="text-xs text-red-200 mt-0.5">
                Tap untuk melihat info penting dari pengurus RT
              </p>
            </div>
            <Link href="/beranda/pengumuman"
              className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5
                rounded-lg font-semibold flex-shrink-0 transition-colors">
              Lihat →
            </Link>
          </div>
        )}

        {/* ── Announcements section ───────────────────────────────── */}
        {rtGroupId && (
          <div className="bg-white rounded-2xl border border-gray-200
            shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center
              justify-between">
              <div className="flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-blue-600" />
                <h2 className="font-bold text-gray-900 text-sm">
                  Pengumuman RT
                </h2>
                {totalAnn > 0 && (
                  <span className="bg-blue-100 text-blue-700 text-[10px]
                    font-bold px-2 py-0.5 rounded-full">
                    {totalAnn}
                  </span>
                )}
              </div>
              {totalAnn > 2 && (
                <Link href="/beranda/pengumuman"
                  className="text-xs text-blue-600 font-semibold hover:text-blue-800
                    flex items-center gap-1">
                  Lihat semua
                  <ChevronRight className="w-3 h-3" />
                </Link>
              )}
            </div>

            {latestAnn.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <Megaphone className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">
                  Belum ada pengumuman dari pengurus RT
                </p>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {latestAnn.map(ann => (
                  <AnnouncementPreview key={ann.id} ann={ann} />
                ))}
                {totalAnn > 2 && (
                  <Link href="/beranda/pengumuman"
                    className="block w-full py-2.5 text-center text-xs font-semibold
                      text-blue-600 hover:text-blue-800 border border-blue-100
                      rounded-xl hover:bg-blue-50 transition-colors">
                    Lihat {totalAnn - 2} pengumuman lainnya →
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Quick links ─────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200
          shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-900 text-sm">Menu Warga</h2>
          </div>
          {[
            {
              icon:    "💳",
              label:   "Tagihan Iuran",
              desc:    "Lihat status tagihan bulanan",
              href:    rtGroupId ? "/beranda/tagihan" : null,
              soon:    !rtGroupId,
            },
            {
              icon:    "📢",
              label:   "Semua Pengumuman",
              desc:    `${totalAnn} pengumuman dari pengurus RT`,
              href:    rtGroupId ? "/beranda/pengumuman" : null,
              soon:    !rtGroupId,
            },
            {
              icon:    "📋",
              label:   "Laporan Masalah",
              desc:    "Laporkan masalah di lingkungan RT",
              href:    rtGroupId ? "/beranda/laporan" : null,
              soon:    !rtGroupId,
            },
            {
              icon:    "👤",
              label:   "Profil Saya",
              desc:    "Update data diri dan nomor HP",
              href:    "/beranda/profil",
              soon:    false,
            },
            {
              icon:    "👨‍👩‍👧",
              label:   "Anggota Keluarga",
              desc:    "Kelola data anggota KK",
              href:    rtGroupId ? "/beranda/keluarga" : null,
              soon:    !rtGroupId,
            },
          ].map((item) => (
            <div key={item.label}>
              {item.href ? (
                <Link href={item.href}
                  className="flex items-center gap-4 px-5 py-4 border-b
                    border-gray-50 last:border-0 hover:bg-gray-50
                    transition-colors">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex
                    items-center justify-center text-xl flex-shrink-0">
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">
                      {item.label}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                </Link>
              ) : (
                <div className="flex items-center gap-4 px-5 py-4 border-b
                  border-gray-50 last:border-0 opacity-60">
                  <div className="w-10 h-10 bg-gray-100 rounded-xl flex
                    items-center justify-center text-xl flex-shrink-0">
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">
                      {item.label}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                  </div>
                  {item.soon && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2
                      py-1 rounded-full font-medium flex-shrink-0">
                      Segera
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ── Contact ─────────────────────────────────────────────── */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl
          p-5 text-center">
          <p className="text-sm font-bold text-blue-900 mb-1">Ada pertanyaan?</p>
          <p className="text-xs text-blue-700 mb-3">
            Hubungi pengurus RT Anda untuk bantuan
          </p>
          <a href="https://wa.me/6281234567890"
            className="inline-flex items-center gap-2 bg-blue-900 text-white
              px-4 py-2 rounded-lg text-xs font-semibold hover:bg-blue-800
              transition-colors">
            💬 Chat WhatsApp
          </a>
        </div>

      </div>
    </div>
  );
}
