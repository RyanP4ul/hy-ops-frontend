import {
  CheckCircle2,
  Navigation,
  RotateCcw,
  Wrench,
  Ban,
  Truck,
} from "lucide-react";
import type { ElementType } from "react";
import { cn } from "@/lib/utils";
import type { BlockedReason, Vehicle } from "../types";

const STYLES: Record<
  Vehicle["status"] | BlockedReason,
  { label: string; icon: ElementType; className: string }
> = {
  delivering: {
    label: "On route",
    icon: Navigation,
    className:
      "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-200",
  },
  returning: {
    label: "Returning",
    icon: RotateCcw,
    className:
      "border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-200",
  },
  available: {
    label: "Available",
    icon: CheckCircle2,
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200",
  },
  maintenance: {
    label: "Maintenance",
    icon: Wrench,
    className:
      "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200",
  },
  unavailable: {
    label: "Unavailable",
    icon: Ban,
    className:
      "border-border bg-muted text-muted-foreground",
  },
  on_delivery: {
    label: "On delivery",
    icon: Truck,
    className:
      "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-200",
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
  const Icon = style.icon;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        style.className,
        className,
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden="true" />
      {style.label}
    </span>
  );
}
