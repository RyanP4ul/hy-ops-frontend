import { cn } from "@/lib/utils";
import { formatAgo } from "../lib/format";
import type { BlockedReason, ResolvedPosition, Vehicle } from "../types";

const STATUS_META: Record<
  Vehicle["status"] | BlockedReason,
  { label: string; dot: string; text: string }
> = {
  delivering: {
    label: "On route",
    dot: "bg-blue-600 dark:bg-blue-400",
    text: "text-blue-700 dark:text-blue-300",
  },
  returning: {
    label: "Returning",
    dot: "bg-indigo-500 dark:bg-indigo-400",
    text: "text-indigo-700 dark:text-indigo-300",
  },
  available: {
    label: "Available",
    dot: "bg-emerald-600 dark:bg-emerald-400",
    text: "text-emerald-700 dark:text-emerald-300",
  },
  maintenance: {
    label: "Maintenance",
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-300",
  },
  unavailable: {
    label: "Unavailable",
    dot: "bg-muted-foreground/60",
    text: "text-muted-foreground",
  },
  on_delivery: {
    label: "On delivery",
    dot: "bg-blue-600 dark:bg-blue-400",
    text: "text-blue-700 dark:text-blue-300",
  },
};

export function StatusLabel({
  status,
  className,
}: {
  status: Vehicle["status"] | BlockedReason;
  className?: string;
}) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 text-xs font-medium whitespace-nowrap",
        meta.text,
        className,
      )}
    >
      <span
        className={cn("size-1.5 shrink-0 rounded-full", meta.dot)}
        aria-hidden="true"
      />
      {meta.label}
    </span>
  );
}

export function GpsLabel({
  position,
  className,
}: {
  position: ResolvedPosition;
  className?: string;
}) {
  switch (position.health) {
    case "fresh":
      return (
        <span
          className={cn(
            "text-[11px] tabular-nums text-muted-foreground whitespace-nowrap",
            className,
          )}
        >
          GPS · {formatAgo(position.ageMs ?? 0)}
        </span>
      );
    case "delayed":
      return (
        <span
          className={cn(
            "text-[11px] font-medium tabular-nums text-amber-700 dark:text-amber-400 whitespace-nowrap",
            className,
          )}
        >
          Delayed · {formatAgo(position.ageMs ?? 0)}
        </span>
      );
    case "stale":
      return (
        <span
          className={cn(
            "text-[11px] font-medium tabular-nums text-orange-700 dark:text-orange-400 whitespace-nowrap",
            className,
          )}
        >
          {position.ageMs === null
            ? "Invalid GPS"
            : `Stale · ${formatAgo(position.ageMs)}`}
        </span>
      );
    case "simulated":
      return (
        <span
          className={cn(
            "text-[11px] font-medium text-violet-700 dark:text-violet-300 whitespace-nowrap",
            className,
          )}
        >
          Simulated
        </span>
      );
    case "none":
      return (
        <span
          className={cn(
            "text-[11px] text-muted-foreground/80 whitespace-nowrap",
            className,
          )}
        >
          No GPS
        </span>
      );
  }
}
