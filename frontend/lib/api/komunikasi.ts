// lib/api/komunikasi.ts
import type { Announcement, Laporan } from "@/types";
import apiClient from "./client";

export const komunikasiApi = {
  announcements: {
    list: async (rtGroupId: string): Promise<Announcement[]> => {
      const res = await apiClient.get(`/komunikasi/announcements/${rtGroupId}`);
      return res.data;
    },
    create: async (data: {
      rt_group_id: string; title: string; body: string;
      ann_type: string; channel: string;
    }): Promise<Announcement> => {
      const res = await apiClient.post("/komunikasi/announcements", data);
      return res.data;
    },
  },

  laporan: {
    list: async (rtGroupId: string, status?: string): Promise<Laporan[]> => {
      const params = status ? { status_filter: status } : {};
      const res = await apiClient.get(`/komunikasi/laporan/${rtGroupId}`, { params });
      return res.data;
    },
    resolve: async (laporanId: string, notes: string): Promise<Laporan> => {
      const res = await apiClient.patch(`/komunikasi/laporan/${laporanId}/resolve`, { notes });
      return res.data;
    },
  },
};
