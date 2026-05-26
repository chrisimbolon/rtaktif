// app/(admin)/layout.tsx
// Auth guard + RT group loader
"use client";
import { AdminHeader } from "@/components/layout/AdminHeader";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { SessionGuard } from "@/components/shared/SessionGuard";
import { useRTGroup } from "@/lib/hooks/useRTGroup";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

const ADMIN_ROLES = ["admin_rt", "admin_rw", "super_admin"];

const PAGE_META: Record<string, { title: string; subtitle?: string }> = {
  "/dashboard":  { title: "Dashboard",      subtitle: "Ringkasan RT Anda hari ini"   },
  "/warga":      { title: "Data Warga",      subtitle: "Kelola data penduduk RT"      },
  "/tagihan":    { title: "Tagihan & Iuran", subtitle: "Kelola pembayaran bulanan"    },
  "/pengumuman": { title: "Pengumuman",      subtitle: "Broadcast informasi ke warga" },
  "/laporan":    { title: "Laporan Warga",   subtitle: "Keluhan & laporan dari warga" },
  "/pengaturan": { title: "Pengaturan",      subtitle: "Konfigurasi RT Anda"          },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router   = useRouter();
  const pathname = usePathname();
  const meta     = PAGE_META[pathname] ?? { title: "RTMudah" };

  // ── Auto-fetch + cache RT group in Zustand store ──────────────────
  // This is what makes the sidebar show "RT 05/RW 02 — Padang Harapan"
  useRTGroup();

  useEffect(() => {
    if (status === "loading") return;

    if (!session) {
      router.replace(`/login?callbackUrl=${pathname}`);
      return;
    }

    const role    = (session.user as any)?.role   ?? "";
    const uStatus = (session.user as any)?.status ?? "";

    if (uStatus === "suspended") { router.replace("/login?error=AccountSuspended"); return; }
    if (uStatus === "pending")   { router.replace("/login?error=AccountPending");   return; }
    if (!ADMIN_ROLES.includes(role)) { router.replace("/beranda"); return; }

  }, [session, status, router, pathname]);

  return (
    <SessionGuard>
      <div className="flex min-h-screen bg-gray-100">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <AdminHeader title={meta.title} subtitle={meta.subtitle} />
          <main className="flex-1 p-6 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </SessionGuard>
  );
}
