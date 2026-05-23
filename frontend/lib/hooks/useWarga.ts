// lib/hooks/useWarga.ts
import { wargaApi } from "@/lib/api/warga";
import { useRTStore } from "@/store/rt.store";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useWargaList(status?: string) {
  const { activeRT } = useRTStore();
  return useQuery({
    queryKey:  ["warga", activeRT?.id, status],
    queryFn:   () => wargaApi.list(activeRT!.id, status),
    enabled:   !!activeRT?.id,
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

export function useMoveOutWarga() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => wargaApi.moveOut(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["warga"] });
      toast.success("Status warga diubah ke pindah");
    },
    onError: () => toast.error("Gagal mengubah status warga"),
  });
}
