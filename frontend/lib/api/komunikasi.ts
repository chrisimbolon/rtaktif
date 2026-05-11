import apiClient from "./client";
import type { Announcement, Laporan } from "@/types";

export const komunikasiApi = {
  announcements: {
    list: (rtGroupId: string) =>
      apiClient.get<Announcement[]>(`/komunikasi/announcements/${rtGroupId}`).then((r) => r.data),
    create: (data: { rt_group_id: string; title: string; body: string; ann_type: string; channel: string }) =>
      apiClient.post<{ id: string; title: string }>("/komunikasi/announcements", data).then((r) => r.data),
  },
  laporan: {
    list: (rtGroupId: string, statusFilter?: string) =>
      apiClient.get<Laporan[]>(`/komunikasi/laporan/${rtGroupId}`, { params: { status_filter: statusFilter } }).then((r) => r.data),
    submit: (data: { rt_group_id: string; title: string; description: string; photo_url?: string }) =>
      apiClient.post<{ id: string; status: string }>("/komunikasi/laporan", data).then((r) => r.data),
    resolve: (id: string, notes: string) =>
      apiClient.patch<{ id: string; status: string }>(`/komunikasi/laporan/${id}/resolve`, { notes }).then((r) => r.data),
  },
  waBlast: (data: { rt_group_id: string; phone_numbers: string[]; message: string }) =>
    apiClient.post("/komunikasi/wa/blast", data).then((r) => r.data),
};
