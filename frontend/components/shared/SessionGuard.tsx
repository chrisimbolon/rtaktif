// components/shared/SessionGuard.tsx
// Prevents flash of unauthenticated content while NextAuth hydrates
"use client";
import { Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";

interface Props {
  children:    React.ReactNode;
  showLoader?: boolean;
}

export function SessionGuard({ children, showLoader = true }: Props) {
  const { status } = useSession();

  if (status === "loading" && showLoader) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream-100">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-forest-800 flex items-center justify-center">
            <span className="font-bold text-white text-lg">RT</span>
          </div>
          <Loader2 className="w-5 h-5 animate-spin text-forest-600" />
          <p className="text-xs text-charcoal-400 font-medium">Memuat sesi...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
