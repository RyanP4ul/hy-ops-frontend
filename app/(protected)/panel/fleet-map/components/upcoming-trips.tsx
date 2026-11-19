import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDay, formatTime, pluralize } from "../lib/format";
import type { Trip } from "../types";

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
      <p className="py-8 text-center text-xs text-muted-foreground">
        No upcoming trips scheduled.
      </p>
    );
  }

  return (
    <div className="space-y-2.5">
      <ul className="divide-y divide-border/60 rounded-lg border bg-background">
        {trips.map((trip) => {
          const previewing = previewTripId === trip.id;
          const confirming = confirmingId === trip.id;

          return (
            <li
              key={trip.id}
              className={cn(
                "space-y-2 p-2.5 transition-colors",
                previewing && "bg-primary/5",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-semibold text-foreground">
                      {trip.label}
                    </span>
                    {trip.phase === "overdue" ? (
                      <span className="shrink-0 text-[10px] font-semibold text-destructive">
                        Overdue
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                    {formatDay(trip.scheduledAt)} · {formatTime(trip.scheduledAt)}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                  {pluralize(trip.stops.length, "stop")}
                </span>
              </div>

              <p className="line-clamp-2 text-[11px] text-muted-foreground">
                {trip.stops.map((stop) => stop.name).join(" → ")}
              </p>

              <div className="flex items-center gap-1.5 pt-0.5">
                <Button
                  type="button"
                  size="sm"
                  variant={previewing ? "secondary" : "outline"}
                  className="h-6 px-2 text-[11px]"
                  onClick={() => onPreview(previewing ? null : trip.id)}
                >
                  {previewing ? "Hide preview" : "Preview"}
                </Button>

                {trip.phase === "overdue" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto h-6 px-2 text-[11px]"
                    nativeButton={false}
                    render={<Link href="/panel/deliveries?overdue=true" />}
                  >
                    Reschedule
                  </Button>
                ) : confirming ? (
                  <div className="ml-auto flex items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[11px]"
                      disabled={dispatching}
                      onClick={() => setConfirmingId(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-6 px-2 text-[11px]"
                      disabled={dispatching}
                      onClick={() => {
                        setConfirmingId(null);
                        onDispatch(trip.id);
                      }}
                    >
                      {dispatching ? "Dispatching…" : "Confirm"}
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    className="ml-auto h-6 px-2.5 text-[11px]"
                    disabled={dispatchBlockedReason !== null || dispatching}
                    title={dispatchBlockedReason ?? undefined}
                    onClick={() => setConfirmingId(trip.id)}
                  >
                    Dispatch
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {dispatchBlockedReason ? (
        <p className="text-[11px] text-muted-foreground">
          Unavailable to dispatch: {dispatchBlockedReason}.
        </p>
      ) : simulationOn ? (
        <p className="text-[11px] text-violet-700 dark:text-violet-300">
          Simulation mode — dispatch is local only.
        </p>
      ) : null}
    </div>
  );
}
