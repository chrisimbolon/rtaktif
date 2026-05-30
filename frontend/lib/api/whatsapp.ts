// lib/api/whatsapp.ts
// RTMudah owns ONE Fonnte account — Ketua RT just clicks buttons
import apiClient from "./client";

export interface WAReminderResult {
  sent:    number;
  failed:  number;
  total:   number;
  period:  string;
  message: string;
}

export interface WABroadcastResult {
  sent:    number;
  failed:  number;
  total:   number;
  message: string;
}

export interface NotifLog {
  id:              string;
  trigger_type:    string;
  notif_type:      string;
  recipient_count: number;
  message_preview: string;
  status:          "sent" | "failed" | "partial";
  failed_count:    number;
  sent_at:         string;
}

// ── Tagihan reminder — auto-fetches unpaid warga phones ───────────────────────
export async function sendTagihanReminder(
  rtGroupId: string,
  year:      number,
  month:     number,
): Promise<WAReminderResult> {
  const { data } = await apiClient.post<WAReminderResult>(
    `/komunikasi/wa/tagihan-reminder/${rtGroupId}?year=${year}&month=${month}`
  );
  return data;
}

// ── Broadcast — auto-fetches all active warga phones ─────────────────────────
export async function sendBroadcast(
  rtGroupId: string,
  title:     string,
  content:   string,
): Promise<WABroadcastResult> {
  const message =
    `📢 *${title}*\n\n${content}\n\n_Pesan otomatis dari RTMudah_`;
  const { data } = await apiClient.post<WABroadcastResult>(
    `/komunikasi/wa/broadcast/${rtGroupId}`,
    { rt_group_id: rtGroupId, phone_numbers: [], message }
  );
  return data;
}

// ── Notification logs — WA blast audit history ────────────────────────────────
export async function getNotifLogs(rtGroupId: string): Promise<NotifLog[]> {
  const { data } = await apiClient.get<NotifLog[]>(
    `/komunikasi/notification-logs/${rtGroupId}`
  );
  return data;
}
