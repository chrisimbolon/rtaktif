// components/ui/avatar.tsx
import { cn } from "@/lib/utils";

// Colour palette for avatar backgrounds — deterministic from name
const COLOURS = [
  "bg-forest-600 text-white",
  "bg-terra-500  text-white",
  "bg-blue-600   text-white",
  "bg-purple-600 text-white",
  "bg-amber-500  text-white",
  "bg-teal-600   text-white",
];

function getColour(name: string): string {
  const idx = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return COLOURS[idx % COLOURS.length];
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");
}

interface AvatarProps {
  name:       string;
  size?:      "xs" | "sm" | "md" | "lg";
  imageUrl?:  string;
  className?: string;
}

const SIZE_CLASSES = {
  xs: "w-6  h-6  text-[10px]",
  sm: "w-8  h-8  text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-12 h-12 text-base",
};

export function Avatar({ name, size = "md", imageUrl, className }: AvatarProps) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className={cn(
          "rounded-full object-cover flex-shrink-0",
          SIZE_CLASSES[size],
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-bold flex-shrink-0 font-display",
        SIZE_CLASSES[size],
        getColour(name),
        className
      )}
    >
      {getInitials(name)}
    </div>
  );
}
