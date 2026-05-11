import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RTGroup } from "@/types";

interface RTState {
  activeRT: RTGroup | null;
  setActiveRT: (rt: RTGroup) => void;
  clearRT: () => void;
}

export const useRTStore = create<RTState>()(
  persist(
    (set) => ({
      activeRT: null,
      setActiveRT: (rt) => set({ activeRT: rt }),
      clearRT:    () => set({ activeRT: null }),
    }),
    { name: "rukunrt-rt" }
  )
);
