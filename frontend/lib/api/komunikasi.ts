// lib/api/komunikasi.ts
// Updated — adds laporan.submit + laporan.myList
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
    // Admin: list all laporan for RT (with optional status filter)
    list: async (rtGroupId: string, status?: string): Promise<Laporan[]> => {
      const params = status ? { status_filter: status } : {};
      const res = await apiClient.get(
        `/komunikasi/laporan/${rtGroupId}`, { params }
      );
      return res.data;
    },

    // Warga: submit a new laporan
    submit: async (data: {
      rt_group_id: string;
      title:       string;
      description: string;
      photo_url?:  string | null;
    }): Promise<Laporan> => {
      const res = await apiClient.post("/komunikasi/laporan", data);
      return res.data;
    },

    // Admin: resolve a laporan with notes
    resolve: async (laporanId: string, notes: string): Promise<Laporan> => {
      const res = await apiClient.patch(
        `/komunikasi/laporan/${laporanId}/resolve`, { notes }
      );
      return res.data;
    },
  },
};
