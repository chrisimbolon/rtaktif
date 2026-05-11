"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tagihanApi } from "@/lib/api/tagihan";
import { useRTStore } from "@/store/rt.store";
import { toast } from "sonner";

export function useUnpaidInvoices() {
  const { activeRT } = useRTStore();
  return useQuery({
    queryKey: ["tagihan", "unpaid", activeRT?.id],
    queryFn: () => tagihanApi.unpaid(activeRT!.id),
    enabled: !!activeRT?.id,
  });
}

export function useGenerateBulk() {
  const qc = useQueryClient();
  const { activeRT } = useRTStore();
  return useMutation({
    mutationFn: (data: { year: number; month: number; amount_idr: number }) =>
      tagihanApi.generateBulk({ ...data, rt_group_id: activeRT!.id }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["tagihan"] });
      toast.success(`${res.invoices_created} tagihan berhasil dibuat 🎉`);
    },
  });
}

export function useConfirmPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, method, bukti_url }: { id: string; method: string; bukti_url?: string }) =>
      tagihanApi.confirmPayment(id, { method, bukti_url }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tagihan"] });
      toast.success("Pembayaran dikonfirmasi ✅");
    },
  });
}
