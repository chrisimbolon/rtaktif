"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { wargaApi } from "@/lib/api/warga";
import { useRTStore } from "@/store/rt.store";
import { toast } from "sonner";

export function useWargaList(statusFilter?: string) {
  const { activeRT } = useRTStore();
  return useQuery({
    queryKey: ["warga", activeRT?.id, statusFilter],
    queryFn: () => wargaApi.list(activeRT!.id, statusFilter),
    enabled: !!activeRT?.id,
  });
}

export function useVerifyWarga() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => wargaApi.verify(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["warga"] });
      toast.success("Warga berhasil diverifikasi ✅");
    },
    onError: () => toast.error("Gagal memverifikasi warga"),
  });
}
