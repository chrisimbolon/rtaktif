// lib/hooks/useTagihan.ts
import { tagihanApi } from "@/lib/api/tagihan";
import { useRTStore } from "@/store/rt.store";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useUnpaidInvoices() {
  const { activeRT } = useRTStore();
  return useQuery({
    queryKey: ["tagihan", "unpaid", activeRT?.id],
    queryFn:  () => tagihanApi.unpaid(activeRT!.id),
    enabled:  !!activeRT?.id,
  });
}

export function useInvoicesByPeriod(year: number, month: number) {
  const { activeRT } = useRTStore();
  return useQuery({
    queryKey: ["tagihan", "period", activeRT?.id, year, month],
    queryFn:  () => tagihanApi.byPeriod(activeRT!.id, year, month),
    enabled:  !!activeRT?.id,
  });
}

export function useGenerateBulk() {
  const qc = useQueryClient();
  const { activeRT } = useRTStore();
  return useMutation({
    mutationFn: (data: { year: number; month: number; amount_idr: number }) =>
      tagihanApi.generateBulk({ rt_group_id: activeRT!.id, ...data }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["tagihan"] });
      toast.success(`${res.invoices_created} tagihan berhasil dibuat 🎉`);
    },
    onError: () => toast.error("Gagal membuat tagihan"),
  });
}

export function useConfirmPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, method, buktiUrl }: {
      id: string; method: string; buktiUrl?: string;
    }) => tagihanApi.confirmPayment(id, { method, bukti_url: buktiUrl }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tagihan"] });
      toast.success("Pembayaran dikonfirmasi ✅");
    },
    onError: () => toast.error("Gagal konfirmasi pembayaran"),
  });
}
