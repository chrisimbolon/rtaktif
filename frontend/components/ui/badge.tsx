// components/ui/badge.tsx
import { cn } from "@/lib/utils";

type BadgeVariant = "green" | "amber" | "red" | "blue" | "gray";

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  green: "bg-green-50  text-green-700  border-green-200",
  amber: "bg-amber-50  text-amber-700  border-amber-200",
  red:   "bg-red-50    text-red-700    border-red-200",
  blue:  "bg-blue-50   text-blue-700   border-blue-200",
  gray:  "bg-gray-50   text-gray-600   border-gray-200",
};

const STATUS_LABELS: Record<string, string> = {
  // User / Resident
  active:      "Aktif",
  pending:     "Menunggu",
  suspended:   "Disuspend",
  moved_out:   "Pindah",
  // Invoice
  paid:        "Lunas",
  issued:      "Belum Bayar",
  overdue:     "Jatuh Tempo",
  cancelled:   "Dibatalkan",
  // Laporan
  open:        "Terbuka",
  in_progress: "Diproses",
  resolved:    "Selesai",
};

interface StatusBadgeProps {
  status:    string;
  variant?:  BadgeVariant;
  className?: string;
}

export function StatusBadge({ status, variant = "gray", className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border",
        VARIANT_CLASSES[variant],
        className
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

// Generic badge for custom labels
interface BadgeProps {
  children:   React.ReactNode;
  variant?:   BadgeVariant;
  className?: string;
}

export function Badge({ children, variant = "gray", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border",
        VARIANT_CLASSES[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
