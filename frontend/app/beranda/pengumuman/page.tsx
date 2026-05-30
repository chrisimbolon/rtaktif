"use client";
// app/beranda/pengumuman/page.tsx
// Warga reads all announcements — mobile-first
import { useSession }     from "next-auth/react";
import { useQuery }       from "@tanstack/react-query";
import { useRouter }      from "next/navigation";
import { useEffect }      from "react";
import Link               from "next/link";
import { komunikasiApi }  from "@/lib/api/komunikasi";
import {
  ArrowLeft, Megaphone, AlertTriangle,
  Calendar, Info, Loader2,
} from "lucide-react";
import type { Announcement } from "@/types";

// ── Config ────────────────────────────────────────────────────────────────────

const ANN_CONFIG = {
  info: {
    icon:    Info,
    label:   "Informasi",
    color:   "bg-blue-50  border-blue-200  text-blue-700",
    border:  "border-l-blue-500",
    badge:   "bg-blue-100 text-blue-700",
  },
  urgent: {
    icon:    AlertTriangle,
    label:   "Mendesak",
    color:   "bg-red-50   border-red-200   text-red-700",
    border:  "border-l-red-500",
    badge:   "bg-red-100  text-red-700",
  },
  event: {
    icon:    Calendar,
    label:   "Kegiatan",
    color:   "bg-green-50 border-green-200 text-green-700",
    border:  "border-l-green-500",
    badge:   "bg-green-100 text-green-700",
  },
} as const;

// ── Announcement Card ─────────────────────────────────────────────────────────

function AnnouncementCard({ ann }: { ann: Announcement }) {
  const cfg  = ANN_CONFIG[ann.ann_type as keyof typeof ANN_CONFIG] ?? ANN_CONFIG.info;
  const Icon = cfg.icon;

  const dateStr = ann.created_at
    ? new Date(ann.created_at).toLocaleDateString("id-ID", {
        weekday: "long",
        day:     "numeric",
        month:   "long",
        year:    "numeric",
      })
    : "—";

  return (
    <div className={`bg-white rounded-2xl border border-gray-200 shadow-sm
      border-l-4 ${cfg.border} overflow-hidden`}>
      <div className="p-5">

        {/* Type badge + date */}
        <div className="flex items-center justify-between mb-3">
          <span className={`inline-flex items-center gap-1.5 text-xs font-bold
            px-2.5 py-1 rounded-full ${cfg.badge}`}>
            <Icon className="w-3 h-3" />
            {cfg.label}
          </span>
          <span className="text-[10px] text-gray-400">{dateStr}</span>
        </div>

        {/* Title */}
        <h3 className="font-extrabold text-gray-900 text-base leading-snug mb-2">
          {ann.title}
        </h3>

        {/* Body */}
        <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
          {ann.body}
        </p>

      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function BerandaPengumumanPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  const user      = session?.user as any;
  const rtGroupId = user?.rt_group_id as string | undefined;

  const { data: announcements = [], isLoading, isError, refetch } = useQuery({
    queryKey:  ["announcements", rtGroupId],
    queryFn:   () => komunikasiApi.announcements.list(rtGroupId!),
    enabled:   !!rtGroupId,
    staleTime: 2 * 60 * 1000,
  });

  // Sort: urgent first, then by date desc
  const sorted = [...announcements].sort((a, b) => {
    if (a.ann_type === "urgent" && b.ann_type !== "urgent") return -1;
    if (b.ann_type === "urgent" && a.ann_type !== "urgent") return 1;
    return new Date(b.created_at ?? 0).getTime() -
           new Date(a.created_at ?? 0).getTime();
  });

  const urgentCount = announcements.filter(a => a.ann_type === "urgent").length;

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

      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="bg-blue-900 text-white sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/beranda"
            className="p-2 rounded-lg hover:bg-white/10 transition-colors
              flex-shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <h1 className="font-bold text-sm">Pengumuman RT</h1>
            <p className="text-blue-300 text-xs">
              {announcements.length} pengumuman
              {urgentCount > 0 && ` · ${urgentCount} mendesak`}
            </p>
          </div>
          <div className="w-8 h-8 bg-yellow-400 rounded-lg flex items-center
            justify-center font-extrabold text-blue-900 text-xs flex-shrink-0">
            RT
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">

        {/* ── Urgent banner ──────────────────────────────────────── */}
        {urgentCount > 0 && (
          <div className="bg-red-600 text-white rounded-2xl p-4 flex
            items-center gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-semibold">
              {urgentCount} pengumuman mendesak — harap dibaca segera!
            </p>
          </div>
        )}

        {/* ── Content ───────────────────────────────────────────── */}
        {isLoading ? (
          <div className="py-16 flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            <p className="text-sm text-gray-400">Memuat pengumuman...</p>
          </div>
        ) : isError ? (
          <div className="py-16 text-center">
            <div className="text-4xl mb-3">😕</div>
            <p className="font-bold text-gray-800 mb-1">Gagal memuat pengumuman</p>
            <button
              onClick={() => refetch()}
              className="mt-3 text-sm text-blue-600 hover:underline"
            >
              Coba lagi
            </button>
          </div>
        ) : sorted.length === 0 ? (
          <div className="py-20 text-center">
            <Megaphone className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="font-bold text-gray-700 mb-1">
              Belum ada pengumuman
            </p>
            <p className="text-sm text-gray-400">
              Pengumuman dari pengurus RT akan muncul di sini
            </p>
          </div>
        ) : (
          sorted.map(ann => (
            <AnnouncementCard key={ann.id} ann={ann} />
          ))
        )}

        {/* ── Back link ─────────────────────────────────────────── */}
        {sorted.length > 0 && (
          <Link href="/beranda"
            className="flex items-center justify-center gap-2 py-3 text-sm
              text-blue-600 font-semibold hover:text-blue-800 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Beranda
          </Link>
        )}

      </div>
    </div>
  );
}
