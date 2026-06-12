// app/(admin)/layout.tsx
// Auth guard + RT group loader
"use client";
import { AdminHeader } from "@/components/layout/AdminHeader";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { SessionGuard } from "@/components/shared/SessionGuard";
import { LockScreen } from "@/components/subscription/LockScreen";
import { PaymentModal } from "@/components/subscription/PaymentModal";
import { SubscriptionBanner } from "@/components/subscription/SubscriptionBanner";
import { useRTGroup } from "@/lib/hooks/useRTGroup";
import { useSubscription } from "@/lib/hooks/useSubscription";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const ADMIN_ROLES = ["admin_rt", "admin_rw", "super_admin", "ketua_rt", "superadmin"];

const PAGE_META: Record<string, { title: string; subtitle?: string }> = {
  // ── Ketua RT pages ───────────────────────────────────────────────────────
  "/dashboard":               { title: "Dashboard",          subtitle: "Ringkasan RT Anda hari ini"              },
  "/warga":                   { title: "Data Warga",          subtitle: "Kelola data penduduk RT"                 },
  "/persetujuan":             {title:  "Persetujuan Data Warga",subtitle: "Tinjau permintaan perubahan data dari warga" },
  "/tagihan":                 { title: "Tagihan & Iuran",     subtitle: "Kelola pembayaran bulanan"               },
  "/pengumuman":              { title: "Pengumuman",          subtitle: "Broadcast informasi ke warga"            },
  "/laporan":                 { title: "Laporan Warga",       subtitle: "Keluhan & laporan dari warga"            },
  "/laporan-keuangan":        { title: "Laporan Keuangan",    subtitle: "Rekap keuangan RT"                       },
  "/statistik":               { title: "Statistik",           subtitle: "Data demografis warga"                   },
  "/pengaturan":              { title: "Pengaturan",          subtitle: "Konfigurasi RT Anda"                     },
  // ── Superadmin pages ─────────────────────────────────────────────────────
  "/superadmin/dashboard":    { title: "Platform Dashboard",  subtitle: "Ringkasan platform RTMudah"              },
  "/superadmin/verifikasi":   { title: "Verifikasi Ketua RT", subtitle: "Tinjau & setujui pendaftaran Ketua RT"   },
};


function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const { accessLevel, statusLoading } = useSubscription();
  const [showPayment, setShowPayment]  = useState(false);

  if (statusLoading) return <>{children}</>;

  return (
    <>
      <SubscriptionBanner onPayClick={() => setShowPayment(true)} />
      <>{children}</>
      {accessLevel === "locked" && (
        <LockScreen onPayClick={() => setShowPayment(true)} />
      )}
      {showPayment && (
        <PaymentModal onClose={() => setShowPayment(false)} />
      )}
    </>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router   = useRouter();
  const pathname = usePathname();

  const role = (session?.user as any)?.role ?? "";
  const isSuperadmin = role === "superadmin";

  // Match exact or prefix (e.g. /superadmin/verifikasi/123)
  const meta = Object.entries(PAGE_META).find(([key]) =>
    pathname === key || pathname.startsWith(key + "/")
  )?.[1] ?? { title: "RTMudah" };

  // ── RT group: only load for Ketua RT — superadmin has no RT context ──────
  // Conditional hook call is not allowed in React, so useRTGroup runs always
  // but it gates itself on rt_group_id existing in session — superadmin has
  // no rt_group_id so it becomes a no-op naturally.
  useRTGroup();

  useEffect(() => {
    if (status === "loading") return;

    if (!session) {
      router.replace(`/login?callbackUrl=${pathname}`);
      return;
    }

    const userRole   = (session.user as any)?.role   ?? "";
    const uStatus    = (session.user as any)?.status ?? "";

    if (uStatus === "suspended") { router.replace("/login?error=AccountSuspended"); return; }
    if (uStatus === "pending")   { router.replace("/login?error=AccountPending");   return; }
    if (!ADMIN_ROLES.includes(userRole)) { router.replace("/beranda"); return; }

    // ── Superadmin redirects ───────────────────────────────────────────────
    if (userRole === "superadmin") {
      // Superadmin hitting /dashboard → redirect to superadmin dashboard
      // Prevents them seeing fung fang's RT data 😂
      if (pathname === "/dashboard") {
        router.replace("/superadmin/dashboard");
        return;
      }
      // Superadmin trying to access Ketua RT-only pages → redirect to their dashboard
      const ketuaRTOnlyPaths = [
        "/warga", "/tagihan", "/pengumuman", "/laporan",
        "/laporan-keuangan", "/statistik", "/pengaturan",
      ];
      if (ketuaRTOnlyPaths.some(p => pathname.startsWith(p))) {
        router.replace("/superadmin/dashboard");
        return;
      }
    }

    // ── Non-superadmin trying to access superadmin pages ──────────────────
    if (pathname.startsWith("/superadmin") && userRole !== "superadmin") {
      router.replace("/dashboard");
      return;
    }

  }, [session, status, router, pathname]);

  return (
    <SessionGuard>
      <div className="flex min-h-screen bg-gray-100">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <AdminHeader title={meta.title} subtitle={meta.subtitle} />
          {isSuperadmin ? (
  <main className="flex-1 p-6 overflow-y-auto">
    {children}
  </main>
) : (
  <SubscriptionGate>
    <main className="flex-1 p-6 overflow-y-auto">
      {children}
    </main>
  </SubscriptionGate>
)}
        </div>
      </div>
    </SessionGuard>
  );
}
