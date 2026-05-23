// lib/api/warga.ts
import type { Resident } from "@/types";
import apiClient from "./client";

export const wargaApi = {
  // List all residents for an RT group
  list: async (rtGroupId: string, status?: string): Promise<Resident[]> => {
    const params = status ? { status } : {};
    const res = await apiClient.get(`/warga/rt/${rtGroupId}`, { params });
    return res.data;
  },

  // Get single resident
  getById: async (id: string): Promise<Resident> => {
    const res = await apiClient.get(`/warga/${id}`);
    return res.data;
  },

  // Verify a pending resident
  verify: async (id: string): Promise<Resident> => {
    const res = await apiClient.patch(`/warga/${id}/verify`);
    return res.data;
  },

  // Mark resident as moved out
  moveOut: async (id: string): Promise<Resident> => {
    const res = await apiClient.patch(`/warga/${id}/move-out`);
    return res.data;
  },
};
