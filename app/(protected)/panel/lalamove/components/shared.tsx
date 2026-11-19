import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Booking, PickupWarehouse } from "../types";

export const primaryCtaClass =
  "bg-orange-600 text-white hover:bg-orange-700 dark:bg-orange-600 dark:hover:bg-orange-500";

export const selectInputClass =
  "h-10 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

export function money(
  amount: string | null | undefined,
  currency?: string | null,
) {
  if (amount == null || amount.trim() === "" || !Number.isFinite(Number(amount))) {
    return "—";
  }
  try {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: currency || "PHP",
    }).format(Number(amount));
  } catch {
    return `${amount} ${currency || ""}`.trim();
  }
}

export function dateLabel(value?: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Not synced";
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}

export function words(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^\w/, (character) => character.toUpperCase());
}

export function warehouseAddress(warehouse: PickupWarehouse) {
  return [
    warehouse.street_address,
    warehouse.city,
    warehouse.state,
    warehouse.zip_code,
  ]
    .filter(Boolean)
    .join(", ");
}

export function bookingStatus(booking: Booking) {
  if (booking.booking_state === "UNKNOWN") {
    return { label: "Confirmation uncertain", tone: "warning" } as const;
  }
  if (booking.booking_state === "REVIEW") {
    return { label: "Needs review", tone: "warning" } as const;
  }
  if (booking.booking_state === "CREATING") {
    return { label: "Confirming", tone: "info" } as const;
  }
  if (booking.booking_state === "FAILED") {
    return { label: "Booking failed", tone: "danger" } as const;
  }
  if (booking.booking_state === "RESOLVED") {
    return {
      label: booking.status === "CANCELED" ? "Cancelled" : "Resolved",
      tone: "neutral",
    } as const;
  }
  if (booking.completed_at || booking.status === "COMPLETED") {
    return { label: "Delivered", tone: "success" } as const;
  }
  if (booking.picked_up_at || booking.status === "PICKED_UP") {
    return { label: "On the way", tone: "info" } as const;
  }
  const known: Record<string, string> = {
    ASSIGNING_DRIVER: "Finding driver",
    ON_GOING: "Driver assigned",
    CANCELED: "Cancelled",
    REJECTED: "Driver unavailable",
    EXPIRED: "Expired",
    PENDING: "Pending",
  };
  return {
    label: known[booking.status] || words(booking.status),
    tone: booking.active ? "info" : "neutral",
  } as const;
}

export function StatusPill({ booking }: { booking: Booking }) {
  const status = bookingStatus(booking);
  const dotColors = {
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    danger: "bg-red-500",
    info: "bg-blue-500",
    neutral: "bg-muted-foreground/60",
  };
  const textColors = {
    success: "text-emerald-700 dark:text-emerald-400",
    warning: "text-amber-800 dark:text-amber-300",
    danger: "text-red-700 dark:text-red-400",
    info: "text-foreground",
    neutral: "text-muted-foreground",
  };

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 text-xs font-medium",
        textColors[status.tone],
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-1.5 rounded-full", dotColors[status.tone])}
      />
      {status.label}
    </span>
  );
}

export function QueryError({
  message,
  retry,
}: {
  message: string;
  retry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"
    >
      <span className="text-destructive">{message}</span>
      <Button type="button" variant="outline" size="xs" onClick={retry}>
        <RefreshCw className="size-3" aria-hidden="true" />
        Retry
      </Button>
    </div>
  );
}

export function EmptyBlock({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function RowsSkeleton({
  rows = 3,
  label,
}: {
  rows?: number;
  label: string;
}) {
  return (
    <div
      role="status"
      aria-label={`Loading ${label}`}
      className="divide-y motion-reduce:[&_*]:animate-none"
    >
      {Array.from({ length: rows }, (_, idx) => (
        <div key={idx} className="flex items-center justify-between gap-4 px-5 py-4">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <Skeleton className="h-8 w-20 rounded-md" />
        </div>
      ))}
    </div>
  );
}
