// lib/api/tagihan.ts
import type { Invoice } from "@/types";
import apiClient from "./client";

export const tagihanApi = {
  // Get invoices by period
  byPeriod: async (rtGroupId: string, year: number, month: number): Promise<Invoice[]> => {
    const res = await apiClient.get(`/tagihan/rt/${rtGroupId}`, { params: { year, month } });
    return res.data;
  },

  // Get all unpaid invoices for an RT
  unpaid: async (rtGroupId: string): Promise<Invoice[]> => {
    const res = await apiClient.get(`/tagihan/unpaid/${rtGroupId}`);
    return res.data;
  },

  // Generate bulk invoices for all active residents
  generateBulk: async (data: {
    rt_group_id: string; year: number; month: number; amount_idr: number;
  }): Promise<{ invoices_created: number }> => {
    const res = await apiClient.post("/tagihan/generate-bulk", data);
    return res.data;
  },

  // Confirm a payment
  confirmPayment: async (
    invoiceId: string,
    data: { method: string; bukti_url?: string }
  ): Promise<Invoice> => {
    const res = await apiClient.patch(`/tagihan/${invoiceId}/confirm-payment`, data);
    return res.data;
  },

  // Mark overdue invoices
  markOverdue: async (rtGroupId: string): Promise<{ marked_overdue: number }> => {
    const res = await apiClient.post(`/tagihan/mark-overdue/${rtGroupId}`);
    return res.data;
  },
};
