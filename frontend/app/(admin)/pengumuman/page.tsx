// app/(admin)/pengumuman/page.tsx
"use client";
import { useState }                          from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm }                            from "react-hook-form";
import { zodResolver }                        from "@hookform/resolvers/zod";
import { z }                                  from "zod";
import { useRTStore }                         from "@/store/rt.store";
import { useAuth }                            from "@/lib/hooks/useAuth";
import { komunikasiApi }                      from "@/lib/api/komunikasi";
import { formatDateTime, cn }                 from "@/lib/utils";
import { toast }                              from "sonner";
import {
  Megaphone, Plus, X, Loader2, Send,
  AlertTriangle, Calendar, Info, Eye, Users,
} from "lucide-react";
import type { Announcement } from "@/types";

const ANN_TYPES = [
  { value: "info",   label: "Informasi", icon: Info,          color: "bg-blue-50  text-blue-700  border-blue-200"  },
  { value: "urgent", label: "Mendesak",  icon: AlertTriangle, color: "bg-red-50   text-red-700   border-red-200"   },
  { value: "event",  label: "Kegiatan",  icon: Calendar,      color: "bg-green-50 text-green-700 border-green-200" },
] as const;

const CHANNELS = [
  { value: "both",     label: "App + WhatsApp", desc: "Jangkauan maksimal" },
  { value: "app",      label: "App saja",        desc: "Notifikasi in-app" },
  { value: "whatsapp", label: "WhatsApp saja",   desc: "Via Fonnte WA"     },
] as const;

const schema = z.object({
  title:    z.string().min(5,  "Judul minimal 5 karakter"),
  body:     z.string().min(10, "Isi pesan minimal 10 karakter"),
  ann_type: z.enum(["info", "urgent", "event"]),
  channel:  z.enum(["both", "app", "whatsapp"]),
});
type FormData = z.infer<typeof schema>;

function AnnouncementCard({ ann }: { ann: Announcement }) {
  const cfg  = ANN_TYPES.find((t) => t.value === ann.ann_type) ?? ANN_TYPES[0];
  const Icon = cfg.icon;
  const borderColor = { info: "border-l-blue-500", urgent: "border-l-red-500", event: "border-l-green-500" }[ann.ann_type];

  return (
    <div className={cn("bg-white rounded-xl border border-gray-200 shadow-sm border-l-4 overflow-hidden", borderColor)}>
      <div className="p-5">
        <div className="flex items-start gap-3 mb-3">
          <span className={cn("p-2 rounded-lg flex-shrink-0 border", cfg.color)}>
            <Icon className="w-4 h-4" />
          </span>
          <div className="flex-1 min-w-0">
            <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", cfg.color)}>
              {cfg.label}
            </span>
            <h3 className="font-bold text-sm text-gray-900 mt-1.5 leading-snug">{ann.title}</h3>
          </div>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed mb-4 line-clamp-3">{ann.body}</p>
        <div className="flex items-center justify-between pt-3 border-t border-gray-50">
          <span className="text-[10px] text-gray-400">{formatDateTime(ann.created_at)}</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-[10px] text-gray-400">
              <Users className="w-3 h-3" />
              {ann.recipient_count > 0 ? `${ann.recipient_count} penerima` : "Semua warga"}
            </span>
            <span className={cn("text-[10px] px-2 py-0.5 rounded-full border", {
              "bg-blue-50  text-blue-600  border-blue-200":  ann.channel === "app",
              "bg-orange-50 text-orange-600 border-orange-200": ann.channel === "whatsapp",
              "bg-green-50 text-green-600 border-green-200": ann.channel === "both",
            })}>
              {ann.channel === "both" ? "App + WA" : ann.channel === "app" ? "App" : "WhatsApp"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PengumumanPage() {
  const { activeRT }  = useRTStore();
  const { user }      = useAuth();
  const qc            = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [filterType, setFilterType] = useState("all");

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ["announcements", activeRT?.id],
    queryFn:  () => komunikasiApi.announcements.list(activeRT!.id),
    enabled:  !!activeRT?.id,
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) => komunikasiApi.announcements.create({
      rt_group_id: activeRT!.id, ...data,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["announcements"] });
      toast.success("Pengumuman dipublikasikan 📢");
      setShowCreate(false);
      reset();
    },
    onError: () => toast.error("Gagal mempublikasikan pengumuman"),
  });

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { ann_type: "info", channel: "both" },
  });

  const annType = watch("ann_type");
  const channel = watch("channel");
  const title   = watch("title");
  const body    = watch("body");

  const filtered = filterType === "all"
    ? announcements
    : announcements.filter((a) => a.ann_type === filterType);

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {[{ value: "all", label: "Semua" }, ...ANN_TYPES.map((t) => ({ value: t.value, label: t.label }))].map((f) => (
            <button key={f.value} onClick={() => setFilterType(f.value)}
              className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                filterType === f.value ? "bg-white text-green-700 shadow-sm" : "text-gray-500 hover:text-gray-700")}>
              {f.label}
            </button>
          ))}
        </div>
        <button onClick={() => setShowCreate(!showCreate)}
          className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            showCreate ? "bg-gray-100 text-gray-700 border border-gray-200" : "bg-green-700 text-white hover:bg-green-600")}>
          {showCreate ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showCreate ? "Batal" : "Buat Pengumuman"}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-green-800 px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-lg">
                <Megaphone className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">Buat Pengumuman Baru</h3>
                <p className="text-green-300 text-xs">Broadcast ke seluruh warga RT</p>
              </div>
            </div>
            <button onClick={() => setShowCreate(false)} className="text-green-300 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit((d) => mutation.mutate(d))}>
            <div className="p-5 grid lg:grid-cols-2 gap-6">
              {/* Left: form */}
              <div className="space-y-4">
                {/* Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Kategori</label>
                  <div className="grid grid-cols-3 gap-2">
                    {ANN_TYPES.map((t) => {
                      const Icon = t.icon;
                      return (
                        <button key={t.value} type="button" onClick={() => setValue("ann_type", t.value)}
                          className={cn("flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border text-xs font-medium transition-all",
                            annType === t.value ? t.color : "border-gray-200 text-gray-500 hover:border-gray-300")}>
                          <Icon className="w-4 h-4" />{t.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Judul</label>
                  <input {...register("title")} placeholder="Contoh: Kerja Bakti Minggu Ini"
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30" />
                  {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
                </div>

                {/* Body */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Isi Pengumuman</label>
                  <textarea {...register("body")} placeholder="Tulis isi pengumuman..." rows={4}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500/30" />
                  {errors.body && <p className="text-red-500 text-xs mt-1">{errors.body.message}</p>}
                </div>

                {/* Channel */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Kirim Via</label>
                  <div className="space-y-2">
                    {CHANNELS.map((c) => (
                      <button key={c.value} type="button" onClick={() => setValue("channel", c.value)}
                        className={cn("w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm transition-all",
                          channel === c.value ? "bg-green-50 border-green-400 text-green-800" : "border-gray-200 text-gray-600 hover:border-gray-300")}>
                        <div className="text-left flex-1">
                          <p className="font-medium text-xs">{c.label}</p>
                          <p className="text-[10px] text-gray-400">{c.desc}</p>
                        </div>
                        {channel === c.value && (
                          <div className="w-4 h-4 rounded-full bg-green-600 flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right: preview */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5" /> Preview
                </p>
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 min-h-[200px] flex items-center justify-center">
                  {title || body ? (
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 w-full">
                      <div className="flex items-start gap-3 mb-3">
                        {(() => {
                          const cfg = ANN_TYPES.find((t) => t.value === annType)!;
                          const Icon = cfg.icon;
                          return (
                            <>
                              <span className={cn("p-2 rounded-lg border flex-shrink-0", cfg.color)}>
                                <Icon className="w-4 h-4" />
                              </span>
                              <div>
                                <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", cfg.color)}>
                                  {cfg.label}
                                </span>
                                <h4 className="font-bold text-sm text-gray-900 mt-1.5">{title || "Judul..."}</h4>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed">{body || "Isi pengumuman..."}</p>
                    </div>
                  ) : (
                    <div className="text-center text-gray-400">
                      <Eye className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-xs">Preview muncul saat Anda mengetik</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="px-5 pb-5 flex gap-3">
              <button type="button" onClick={() => setShowCreate(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                Batal
              </button>
              <button type="submit" disabled={mutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-700 text-white text-sm font-medium hover:bg-green-600 transition-colors disabled:opacity-60">
                {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Publikasikan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400 mx-auto" /></div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center">
          <Megaphone className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400 font-medium">Belum ada pengumuman</p>
          <button onClick={() => setShowCreate(true)}
            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-700 text-white text-sm font-medium hover:bg-green-600 transition-colors">
            <Plus className="w-4 h-4" /> Buat Sekarang
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((ann) => <AnnouncementCard key={ann.id} ann={ann} />)}
        </div>
      )}
    </div>
  );
}
