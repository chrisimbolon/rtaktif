import apiClient from "./client";
import type { Invoice } from "@/types";

export const tagihanApi = {
  generateBulk: (data: { rt_group_id: string; year: number; month: number; amount_idr: number }) =>
    apiClient.post<{ invoices_created: number }>("/tagihan/generate-bulk", data).then((r) => r.data),

  byPeriod: (rtGroupId: string, year: number, month: number) =>
    apiClient.get<Invoice[]>(`/tagihan/rt/${rtGroupId}`, { params: { year, month } }).then((r) => r.data),

  unpaid: (rtGroupId: string) =>
    apiClient.get<Invoice[]>(`/tagihan/unpaid/${rtGroupId}`).then((r) => r.data),

  confirmPayment: (id: string, data: { method: string; bukti_url?: string }) =>
    apiClient.patch<{ id: string; status: string }>(`/tagihan/${id}/confirm-payment`, data).then((r) => r.data),

  markOverdue: (rtGroupId: string) =>
    apiClient.post<{ marked_overdue: number }>(`/tagihan/mark-overdue/${rtGroupId}`).then((r) => r.data),
};
