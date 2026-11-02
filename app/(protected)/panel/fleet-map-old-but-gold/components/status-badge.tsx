import type { BlockedReason, Vehicle } from "../types";

const STATUS_STYLES: Record<
  Vehicle["status"] | BlockedReason,
  { label: string; className: string }
> = {
  delivering: {
    label: "Delivering",
    className: "bg-green-500/10 text-green-600",
  },
  returning: {
    label: "Returning",
    className: "bg-amber-500/10 text-amber-600",
  },
  available: {
    label: "Available",
    className: "bg-blue-500/10 text-blue-600",
  },
  maintenance: {
    label: "Maintenance",
    className: "bg-orange-500/10 text-orange-600",
  },
  unavailable: {
    label: "Unavailable",
    className: "bg-muted text-muted-foreground",
  },
};

export function StatusBadge({
  status,
}: {
  status: Vehicle["status"] | BlockedReason;
}) {
  const style = STATUS_STYLES[status];
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${style.className}`}
    >
      {style.label}
    </span>
  );
}
