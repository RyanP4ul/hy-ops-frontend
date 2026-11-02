import { CalendarClock, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { formatCurrency, formatSchedule, pluralize } from "../lib/format";
import { getTripValue } from "../lib/vehicle";
import type { Trip } from "../types";

// Collapsible card for one scheduled trip.
export function TripCard({
  trip,
  color,
  expanded,
  onToggle,
  tag,
  footer,
  children,
}: {
  trip: Trip;
  color: string;
  expanded: boolean;
  onToggle: () => void;
  tag?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div
      className={`overflow-hidden rounded-xl border transition ${
        expanded ? "border-primary/40 bg-primary/5" : "bg-background"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-start gap-3 p-3 text-left transition hover:bg-muted/40"
      >
        <div
          className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${color}18`, color }}
        >
          <CalendarClock className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold">{trip.label}</p>
            {tag}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatSchedule(trip.scheduledAt)}
          </p>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {pluralize(trip.stops.length, "stop")} ·{" "}
            {formatCurrency(getTripValue(trip.stops))}
          </p>
        </div>
        <ChevronDown
          className={`mt-1 size-4 shrink-0 text-muted-foreground transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {expanded && (
        <div className="space-y-2 border-t p-3">
          {children}
          {footer}
        </div>
      )}
    </div>
  );
}
