// components/layout/AdminSidebar.tsx
"use client";
import { useAuth } from "@/lib/hooks/useAuth";
import { cn } from "@/lib/utils";
import { useRTStore } from "@/store/rt.store";
import {
    ClipboardList,
    CreditCard,
    LayoutDashboard,
    LogOut,
    Megaphone,
    Settings,
    Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { label: "Dashboard",   href: "/dashboard",  icon: LayoutDashboard },
  { label: "Data Warga",  href: "/warga",       icon: Users           },
  { label: "Tagihan",     href: "/tagihan",     icon: CreditCard      },
  { label: "Pengumuman",  href: "/pengumuman",  icon: Megaphone       },
  { label: "Laporan",     href: "/laporan",     icon: ClipboardList   },
  { label: "Pengaturan",  href: "/pengaturan",  icon: Settings        },
];

export function AdminSidebar() {
  const pathname     = usePathname();
  const { user, logout } = useAuth();
  const { activeRT } = useRTStore();

  const initials = user?.full_name
    ? user.full_name.split(" ").slice(0, 2).map((n: string) => n[0]).join("").toUpperCase()
    : "A";

  return (
    <aside className="w-60 min-h-screen bg-gray-900 flex flex-col flex-shrink-0">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-orange-500 flex items-center justify-center flex-shrink-0">
            <span className="font-bold text-white text-sm">RT</span>
          </div>
          <div>
            <p className="font-bold text-white text-sm leading-none">RukunRT</p>
            <p className="text-[10px] text-gray-400 mt-0.5 truncate max-w-[120px]">
              {activeRT?.display_name ?? "Pilih RT di pengaturan"}
            </p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
                active
                  ? "bg-gray-700 text-white font-medium"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="px-3 pb-4 border-t border-gray-800 pt-3">
        <div className="flex items-center gap-3 px-3 py-2.5">
          <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">{user?.full_name ?? "Admin"}</p>
            <p className="text-[10px] text-gray-400 capitalize">{user?.role?.replace("_", " ") ?? ""}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Keluar</span>
        </button>
      </div>
    </aside>
  );
}
