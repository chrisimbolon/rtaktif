// components/layout/AdminHeader.tsx
"use client";
import { useAuth } from "@/lib/hooks/useAuth";
import { Bell, Search } from "lucide-react";

interface AdminHeaderProps {
  title:     string;
  subtitle?: string;
}

export function AdminHeader({ title, subtitle }: AdminHeaderProps) {
  const { user } = useAuth();

  const initials = user?.full_name
    ? user.full_name.split(" ").slice(0, 2).map((n: string) => n[0]).join("").toUpperCase()
    : "A";

  return (
    <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between flex-shrink-0">
      <div>
        <h1 className="font-bold text-xl text-gray-900 leading-none">{title}</h1>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            placeholder="Cari warga, tagihan..."
            className="pl-8 pr-4 py-2 text-sm rounded-lg bg-gray-100 border border-gray-200 text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/30 w-52"
          />
        </div>
        <button className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <Bell className="w-4 h-4 text-gray-500" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-orange-500 rounded-full" />
        </button>
        <div className="w-8 h-8 rounded-full bg-green-700 flex items-center justify-center text-white text-xs font-bold">
          {initials}
        </div>
      </div>
    </header>
  );
}
