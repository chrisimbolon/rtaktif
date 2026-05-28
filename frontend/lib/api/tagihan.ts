// lib/api/tagihan.ts
// API client for Tagihan — matches existing backend schema exactly:
//   - uses year + month integers (not period_label string)
//   - uses /tagihan/generate-bulk (not /rt-groups/{id}/invoices/generate)
//   - uses /tagihan/{id}/confirm-payment (not /invoices/{id}/pay)
//   - resident_id references residents table (not users)
import apiClient from "./client";

// ── Types ─────────────────────────────────────────────────────────────────────

export type InvoiceStatus = "issued" | "paid" | "overdue" | "cancelled";
export type PaymentMethod = "cash" | "bank_transfer" | "qris" | "other";

export interface Invoice {
  id:          string;
  resident_id: string;
  period:      string;   // backend returns period_label string in response
  amount_idr:  number;
  status:      InvoiceStatus;
  // enriched client-side from warga list
  resident_name?: string;
}

export interface GenerateBulkResult {
  invoices_created: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style:                 "currency",
    currency:              "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

// Returns { year, month } for a given Date
export function dateToYearMonth(date = new Date()) {
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

// Human-readable label from year + month
export function periodLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat("id-ID", {
    month: "long", year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

// Last N months as { year, month, label } objects
export function getPeriodOptions(count = 6) {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return {
      year:  d.getFullYear(),
      month: d.getMonth() + 1,
      label: new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(d),
    };
  });
}

// ── API calls — matching existing backend routes exactly ──────────────────────

export async function generateBulkInvoices(
  rtGroupId:  string,
  year:       number,
  month:      number,
  amountIdr:  number,
): Promise<GenerateBulkResult> {
  const { data } = await apiClient.post<GenerateBulkResult>(
    "/tagihan/generate-bulk",
    { rt_group_id: rtGroupId, year, month, amount_idr: amountIdr }
  );
  return data;
}

export async function getInvoicesByPeriod(
  rtGroupId: string,
  year:      number,
  month:     number,
): Promise<Invoice[]> {
  const { data } = await apiClient.get<Invoice[]>(
    `/tagihan/rt/${rtGroupId}?year=${year}&month=${month}`
  );
  return data;
}

export async function getUnpaidInvoices(rtGroupId: string): Promise<Invoice[]> {
  const { data } = await apiClient.get<Invoice[]>(
    `/tagihan/unpaid/${rtGroupId}`
  );
  return data;
}

export async function confirmPayment(
  invoiceId: string,
  method:    PaymentMethod = "cash",
  buktiUrl?: string,
): Promise<{ id: string; status: string }> {
  const { data } = await apiClient.patch(
    `/tagihan/${invoiceId}/confirm-payment`,
    { method, bukti_url: buktiUrl ?? null }
  );
  return data;
}

export async function markOverdueByRT(rtGroupId: string): Promise<{ marked_overdue: number }> {
  const { data } = await apiClient.post(`/tagihan/mark-overdue/${rtGroupId}`);
  return data;
}

export const tagihanApi = {
  // Hook expects: tagihanApi.unpaid(rtGroupId)
  unpaid: (rtGroupId: string) => getUnpaidInvoices(rtGroupId),

  // Hook expects: tagihanApi.byPeriod(rtGroupId, year, month)
  byPeriod: (rtGroupId: string, year: number, month: number) =>
    getInvoicesByPeriod(rtGroupId, year, month),

  // Hook expects: tagihanApi.generateBulk({ rt_group_id, year, month, amount_idr })
  generateBulk: (data: { rt_group_id: string; year: number; month: number; amount_idr: number }) =>
    generateBulkInvoices(data.rt_group_id, data.year, data.month, data.amount_idr),

  // Hook expects: tagihanApi.confirmPayment(id, { method, bukti_url })
  confirmPayment: (id: string, body: { method: string; bukti_url?: string }) =>
    confirmPayment(id, body.method as PaymentMethod, body.bukti_url),

  markOverdue: markOverdueByRT,
  formatRupiah,
  periodLabel,
  getPeriodOptions,
};