// types/index.ts — COMPLETE type definitions
// Replace your current types/index.ts with this entire file

// ── Auth ──────────────────────────────────────────────────────────
export type UserRole   = "warga" | "admin_rt" | "admin_rw" | "super_admin";
export type UserStatus = "pending" | "active" | "suspended";

export interface AuthUser {
  id:          string;
  email:       string;
  full_name:   string;
  role:        UserRole;
  status:      UserStatus;
  rt_group_id: string | null;
}

export interface LoginPayload {
  email:    string;
  password: string;
}

export interface RegisterPayload {
  email:       string;
  phone:       string;
  password:    string;
  full_name:   string;
  rt_group_id?: string;
}

// ── RT Group ──────────────────────────────────────────────────────
export interface RTGroup {
  id:              string;
  rt_number:       string;
  rw_number:       string;
  kelurahan:       string;
  kecamatan:       string;
  kota:            string;
  provinsi:        string;
  monthly_fee_idr: number;
  display_name:    string;
  is_active:       boolean;
}

// ── Warga ─────────────────────────────────────────────────────────
export type ResidentStatus = "pending" | "active" | "moved_out";
export type OwnershipType  = "owner"   | "tenant";

export interface Resident {
  id:             string;
  full_name:      string;
  phone:          string;
  block_unit:     string;
  status:         ResidentStatus;
  ownership_type: OwnershipType;
  member_count:   number;
  kk_file_url:    string | null;
  ktp_file_url:   string | null;
  rt_group_id:    string;
  created_at:     string;
}

// ── Tagihan ───────────────────────────────────────────────────────
export type InvoiceStatus = "issued" | "paid" | "overdue" | "cancelled";
export type PaymentMethod = "bank_transfer" | "cash" | "e_wallet";

export interface Invoice {
  id:            string;
  resident_id:   string;
  resident_name?: string;
  period_label:  string;
  amount_idr:    number;
  status:        InvoiceStatus;
  bukti_url:     string | null;
  paid_at:       string | null;
  created_at:    string;
}

// ── Komunikasi ────────────────────────────────────────────────────
export type AnnouncementType = "info" | "urgent" | "event";
export type DeliveryChannel  = "app"  | "whatsapp" | "both";
export type LaporanStatus    = "open" | "in_progress" | "resolved";

export interface Announcement {
  id:              string;
  title:           string;
  body:            string;
  ann_type:        AnnouncementType;
  channel:         DeliveryChannel;
  recipient_count: number;
  created_at:      string;
}

export interface Laporan {
  id:               string;
  title:            string;
  description:      string;
  photo_url:        string | null;
  status:           LaporanStatus;
  resident_id:      string;
  resolved_at:      string | null;
  resolution_notes: string;
  created_at:       string;
}

// ── Notification Log ──────────────────────────────────────────────
export interface NotificationLog {
  id:              string;
  trigger_type:    string;
  notif_type:      string;
  recipient_count: number;
  message_preview: string;
  status:          string;
  failed_count:    number;
  sent_at:         string;
}

// ── Dashboard ─────────────────────────────────────────────────────
export interface DashboardStats {
  total_warga:    number;
  sudah_bayar:    number;
  belum_bayar:    number;
  kas_terkumpul:  number;
  target_bulanan: number;
  laporan_open:   number;
}

// ── API Error ─────────────────────────────────────────────────────
export interface ApiError {
  detail: string;
  status: number;
}
