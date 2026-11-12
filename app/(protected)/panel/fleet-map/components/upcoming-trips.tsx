import { CalendarClock, Eye, EyeOff, Send } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDay, formatTime, pluralize } from "../lib/format";
import type { Trip } from "../types";
import { EmptyState } from "./empty-state";

type UpcomingTripsProps = {
  trips: Trip[];
  previewTripId: string | null;
  dispatchBlockedReason: string | null;
  simulationOn: boolean;
  dispatching: boolean;
  onPreview: (tripId: string | null) => void;
  onDispatch: (tripId: string) => void;
};

export function UpcomingTrips({
  trips,
  previewTripId,
  dispatchBlockedReason,
  simulationOn,
  dispatching,
  onPreview,
  onDispatch,
}: UpcomingTripsProps) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  if (trips.length === 0) {
    return (
      <EmptyState icon={CalendarClock} title="No upcoming trips">
        Trips scheduled for this vehicle will show up here.
      </EmptyState>
    );
  }

  return (
    <ul className="space-y-2.5">
      {trips.map((trip) => {
        const previewing = previewTripId === trip.id;
        const confirming = confirmingId === trip.id;

        return (
          <li
            key={trip.id}
            className={cn(
              "rounded-lg border bg-card p-3",
              previewing && "border-primary ring-1 ring-primary",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                      trip.phase === "overdue"
                        ? "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-200"
                        : "bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200",
                    )}
                  >
                    {trip.phase === "overdue" ? "Overdue" : "Upcoming"}
                  </span>
                  <p className="truncate text-sm font-semibold">{trip.label}</p>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatDay(trip.scheduledAt)} · {formatTime(trip.scheduledAt)}
                </p>
              </div>
              <span className="shrink-0 text-xs font-medium text-muted-foreground">
                {pluralize(trip.stops.length, "stop")}
              </span>
            </div>

            <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
              {trip.stops.map((stop) => stop.name).join(" → ")}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={previewing ? "default" : "outline"}
                className="h-7 gap-1.5 px-2.5 text-xs"
                onClick={() => onPreview(previewing ? null : trip.id)}
              >
                {previewing ? (
                  <EyeOff className="size-3.5" aria-hidden="true" />
                ) : (
                  <Eye className="size-3.5" aria-hidden="true" />
                )}
                {previewing ? "Hide preview" : "Preview route"}
              </Button>

              {trip.phase === "overdue" ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto h-7 px-2.5 text-xs"
                  nativeButton={false}
                  render={<Link href="/panel/deliveries?overdue=true" />}
                >
                  Reschedule in Deliveries
                </Button>
              ) : confirming ? (
                <div className="ml-auto flex items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    disabled={dispatching}
                    onClick={() => setConfirmingId(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 px-2.5 text-xs"
                    disabled={dispatching}
                    onClick={() => {
                      setConfirmingId(null);
                      onDispatch(trip.id);
                    }}
                  >
                    {dispatching ? "Dispatching…" : "Confirm dispatch"}
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  className="ml-auto h-7 gap-1.5 px-2.5 text-xs"
                  disabled={dispatchBlockedReason !== null || dispatching}
                  title={dispatchBlockedReason ?? undefined}
                  onClick={() => setConfirmingId(trip.id)}
                >
                  <Send className="size-3.5" aria-hidden="true" />
                  Dispatch
                </Button>
              )}
            </div>
          </li>
        );
      })}

      {dispatchBlockedReason ? (
        <li className="text-xs text-muted-foreground">
          Dispatch unavailable: {dispatchBlockedReason}.
        </li>
      ) : simulationOn ? (
        <li className="text-xs text-violet-700 dark:text-violet-300">
          Simulation mode: dispatching here is local only and not saved.
        </li>
      ) : null}
    </ul>
  );
}
