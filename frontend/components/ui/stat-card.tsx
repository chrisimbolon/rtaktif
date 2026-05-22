// components/ui/stat-card.tsx
import { cn, formatRupiah } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

type StatVariant = "green" | "amber" | "red" | "blue";

const VARIANT_CLASSES: Record<StatVariant, { icon: string; value: string }> = {
  green: { icon: "bg-green-100 text-green-700",  value: "text-green-700"  },
  amber: { icon: "bg-amber-100 text-amber-700",  value: "text-amber-700"  },
  red:   { icon: "bg-red-100   text-red-700",    value: "text-red-700"    },
  blue:  { icon: "bg-blue-100  text-blue-700",   value: "text-blue-700"   },
};

interface StatCardProps {
  label:      string;
  value:      number;
  sub?:       string;
  icon:       LucideIcon;
  variant?:   StatVariant;
  isCurrency?: boolean;
  className?: string;
}

export function StatCard({
  label, value, sub, icon: Icon,
  variant = "green", isCurrency = false, className,
}: StatCardProps) {
  const cls = VARIANT_CLASSES[variant];

  return (
    <div className={cn(
      "bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-start gap-4",
      className
    )}>
      <div className={cn("p-2.5 rounded-lg flex-shrink-0", cls.icon)}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 font-medium truncate">{label}</p>
        <p className={cn("text-2xl font-bold font-display mt-0.5", cls.value)}>
          {isCurrency ? formatRupiah(value) : value.toLocaleString("id-ID")}
        </p>
        {sub && <p className="text-xs text-gray-400 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
}
