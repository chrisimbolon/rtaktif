// store/rt.store.ts
// Persists RT group so sidebar name survives page refresh
import type { RTGroup } from "@/types";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface RTState {
  activeRT:    RTGroup | null;
  setActiveRT: (rt: RTGroup) => void;
  clearRT:     () => void;
}

export const useRTStore = create<RTState>()(
  persist(
    (set) => ({
      activeRT:    null,
      setActiveRT: (rt) => set({ activeRT: rt }),
      clearRT:     ()   => set({ activeRT: null }),
    }),
    { name: "rtmudah-rt" }  // localStorage key
  )
);
