import apiClient from "./client";
import type { Resident } from "@/types";

export const wargaApi = {
  list: (rtGroupId: string, statusFilter?: string) =>
    apiClient
      .get<Resident[]>(`/warga/rt/${rtGroupId}`, { params: { status_filter: statusFilter } })
      .then((r) => r.data),

  get: (id: string) =>
    apiClient.get<Resident>(`/warga/${id}`).then((r) => r.data),

  verify: (id: string) =>
    apiClient.patch<{ id: string; status: string }>(`/warga/${id}/verify`).then((r) => r.data),

  register: (data: Omit<Resident, "id" | "created_at">) =>
    apiClient.post<{ id: string; status: string }>("/warga", data).then((r) => r.data),
};
