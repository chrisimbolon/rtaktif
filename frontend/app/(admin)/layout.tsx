// app/(admin)/layout.tsx
"use client";
import { AdminHeader } from "@/components/layout/AdminHeader";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { SessionGuard } from "@/components/shared/SessionGuard";
import { usePathname } from "next/navigation";

const PAGE_META: Record<string, { title: string; subtitle?: string }> = {
  "/dashboard":  { title: "Dashboard",       subtitle: "Ringkasan RT Anda hari ini"      },
  "/warga":      { title: "Data Warga",       subtitle: "Kelola data penduduk RT"         },
  "/tagihan":    { title: "Tagihan & Iuran",  subtitle: "Kelola pembayaran bulanan"       },
  "/pengumuman": { title: "Pengumuman",       subtitle: "Broadcast informasi ke warga"    },
  "/laporan":    { title: "Laporan Warga",    subtitle: "Keluhan & laporan dari warga"    },
  "/pengaturan": { title: "Pengaturan",       subtitle: "Konfigurasi RT Anda"             },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const meta     = PAGE_META[pathname] ?? { title: "RukunRT" };

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
