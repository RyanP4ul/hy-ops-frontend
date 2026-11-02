import { cn } from "@/lib/utils";
import type { BlockedReason, Vehicle } from "../types";

const STYLES: Record<
  Vehicle["status"] | BlockedReason,
  { label: string; dot: string; className: string }
> = {
  delivering: {
    label: "On route",
    dot: "bg-blue-500",
    className: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  },
  returning: {
    label: "Returning",
    dot: "bg-violet-500",
    className: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  },
  available: {
    label: "Available",
    dot: "bg-emerald-500",
    className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  maintenance: {
    label: "Maintenance",
    dot: "bg-orange-500",
    className: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
  },
  unavailable: {
    label: "Unavailable",
    dot: "bg-zinc-400",
    className: "bg-muted text-muted-foreground",
  },
  on_delivery: {
    label: "On delivery",
    dot: "bg-blue-500",
    className: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  },
};

export function StatusBadge({
  status,
  className,
}: {
  status: Vehicle["status"] | BlockedReason;
  className?: string;
}) {
  const style = STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        style.className,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", style.dot)} />
      {style.label}
    </span>
  );
}
