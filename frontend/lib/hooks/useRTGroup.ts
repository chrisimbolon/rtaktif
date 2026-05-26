// lib/hooks/useRTGroup.ts
// Auto-fetches RT group on mount and stores it in useRTStore
// Drop this into (admin)/layout.tsx — it runs once per session
"use client";
import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRTStore } from "@/store/rt.store";
import { getRTGroupClient } from "@/lib/api/rtgroup";

export function useRTGroup() {
  const { data: session, status } = useSession();
  const { activeRT, setActiveRT } = useRTStore();

  useEffect(() => {
    // Only fetch if:
    // 1. Session is loaded
    // 2. User has an rt_group_id
    // 3. We don't already have it cached (avoid re-fetching on every nav)
    const rtGroupId = session?.user?.rt_group_id;
    if (status !== "authenticated" || !rtGroupId) return;
    if (activeRT?.id === rtGroupId) return; // already cached ✅

    getRTGroupClient(rtGroupId)
      .then(setActiveRT)
      .catch(() => {}); // silent — sidebar shows fallback text
  }, [status, session?.user?.rt_group_id, activeRT?.id, setActiveRT]);
}
