// components/layout/AdminSidebar.tsx
"use client";
import { getPendingChangeRequests } from "@/lib/api/warga";
import { useAuth } from "@/lib/hooks/useAuth";
import { cn } from "@/lib/utils";
import { useRTStore } from "@/store/rt.store";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Megaphone,
  PieChart,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// ── Ketua RT nav — only shown to non-superadmin roles ──────────────────────
const NAV = [
  { label: "Dashboard",  href: "/dashboard",        icon: LayoutDashboard },
  { label: "Data Warga", href: "/warga",             icon: Users           },
  { label: "Persetujuan",  href: "/persetujuan",      icon: ClipboardCheck  },
  { label: "Tagihan",    href: "/tagihan",           icon: CreditCard      },
  { label: "Pengumuman", href: "/pengumuman",        icon: Megaphone       },
  { label: "Laporan",    href: "/laporan",           icon: ClipboardList   },
  { label: "Keuangan",   href: "/laporan-keuangan",  icon: BarChart3       },
  { label: "Statistik",  href: "/statistik",         icon: PieChart        },
  { label: "Pengaturan", href: "/pengaturan",        icon: Settings        },
];

// ── Superadmin nav — only shown to superadmin role ─────────────────────────
const SUPERADMIN_NAV = [
  { label: "Dashboard",     href: "/superadmin/dashboard",   icon: LayoutDashboard },
  { label: "Verifikasi RT", href: "/superadmin/verifikasi",  icon: ShieldCheck     },
  { label: "Pembayaran",    href: "/superadmin/pembayaran",  icon: CreditCard      },
];

export function AdminSidebar() {
  const pathname                   = usePathname();
  const { fullName, role, logout } = useAuth();
  const { activeRT }               = useRTStore();

  const isSuperadmin = role === "superadmin";

  const initials = (fullName ?? "A")
    .split(" ").slice(0, 2)
    .map((n: string) => n[0])
    .join("").toUpperCase();

  const roleLabel = isSuperadmin ? "Superadmin" : (role ?? "").replace("_", " ");

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const { data: pendingRequests = [] } = useQuery({
  queryKey: ["pending-change-requests"],
  queryFn:  getPendingChangeRequests,
  enabled:  !isSuperadmin,
  staleTime: 30_000,
  refetchInterval: 30_000,
});

  return (
    <aside className="w-60 min-h-screen bg-gray-900 flex flex-col flex-shrink-0">

      {/* ── Logo / identity header ──────────────────────────────────────── */}
      <div className="px-5 py-6 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-orange-500 flex items-center justify-center flex-shrink-0">
            <span className="font-bold text-white text-sm">RT</span>
          </div>
          <div>
            <p className="font-bold text-white text-sm leading-none">RTMudah</p>
            <p className="text-[10px] text-gray-400 mt-0.5 truncate max-w-[120px]">
              {isSuperadmin
                ? "Platform Admin"
                : (activeRT?.display_name ?? "Pilih RT di pengaturan")}
            </p>
          </div>
        </div>
      </div>

      {/* ── Navigation ─────────────────────────────────────────────────── */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {isSuperadmin ? (
          // Superadmin: only platform-level nav
          // Ketua RT tools (Warga/Tagihan/etc) are hidden —
          // they're scoped to a single RT and meaningless for superadmin
          <>
            <div className="pb-1 px-3">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                Platform
              </p>
            </div>
            {SUPERADMIN_NAV.map(({ label, href, icon: Icon }) => (
              <Link key={href} href={href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
                  isActive(href)
                    ? "bg-orange-500/20 text-orange-400 font-medium"
                    : "text-gray-400 hover:bg-gray-800 hover:text-orange-300"
                )}>
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{label}</span>
              </Link>
            ))}
          </>
        ) : (
          // Ketua RT: full RT management nav
          NAV.map(({ label, href, icon: Icon }) => (
            <Link key={href} href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
                isActive(href)
                  ? "bg-gray-700 text-white font-medium"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              )}>
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{label}</span>
              {href === "/persetujuan" && pendingRequests.length > 0 && (
                <span className="flex-shrink-0 min-w-[20px] h-5 px-1.5 rounded-full
                       bg-amber-500 text-white text-[10px] font-bold
                       flex items-center justify-center">
                  {pendingRequests.length}
                </span>
              )}
            </Link>
          ))
        )}
      </nav>

      {/* ── User footer ────────────────────────────────────────────────── */}
      <div className="px-3 pb-4 border-t border-gray-800 pt-3">
        <div className="flex items-center gap-3 px-3 py-2.5">
          <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center
                          text-white text-xs font-bold flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">{fullName ?? "Admin"}</p>
            <p className="text-[10px] text-gray-400 capitalize">{roleLabel}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm
                     text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Keluar</span>
        </button>
      </div>
    </aside>
  );
}
