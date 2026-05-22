// store/rt.store.ts
// Keep your existing rt.store.ts or replace with this
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
    { name: "rukunrt-rt" }
  )
);
