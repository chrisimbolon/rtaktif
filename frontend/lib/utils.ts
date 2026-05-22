// lib/utils.ts — replace your current utils.ts with this
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// ── Tailwind class merger (keep your existing cn) ─────────────────
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Currency formatter ────────────────────────────────────────────
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style:    "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ── Date/time formatters ──────────────────────────────────────────
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day:   "numeric",
    month: "long",
    year:  "numeric",
  }).format(new Date(dateStr));
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day:    "numeric",
    month:  "short",
    year:   "numeric",
    hour:   "2-digit",
    minute: "2-digit",
  }).format(new Date(dateStr));
}

export function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)  return "Baru saja";
  if (mins  < 60) return `${mins} menit lalu`;
  if (hours < 24) return `${hours} jam lalu`;
  if (days  < 7)  return `${days} hari lalu`;
  return formatDate(dateStr);
}

// ── Status badge variant helper ───────────────────────────────────
type BadgeVariant = "green" | "amber" | "red" | "blue" | "gray";

export function getStatusVariant(status: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    // User / Resident
    active:      "green",
    pending:     "amber",
    suspended:   "red",
    moved_out:   "gray",
    // Invoice
    paid:        "green",
    issued:      "amber",
    overdue:     "red",
    cancelled:   "gray",
    // Laporan
    open:        "red",
    in_progress: "blue",
    resolved:    "green",
  };
  return map[status] ?? "gray";
}

// ── Number helpers ────────────────────────────────────────────────
export function formatNumber(n: number): string {
  return new Intl.NumberFormat("id-ID").format(n);
}

export function formatPercent(value: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}
