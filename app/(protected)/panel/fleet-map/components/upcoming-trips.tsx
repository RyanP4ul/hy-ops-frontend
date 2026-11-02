import { CalendarClock, Eye, EyeOff, Send } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  formatCurrency,
  formatDay,
  formatTime,
  pluralize,
} from "../lib/format";
import { getTripValue } from "../lib/vehicle";
import type { Trip } from "../types";
import { EmptyState } from "./empty-state";

type UpcomingTripsProps = {
  trips: Trip[];
  previewTripId: string | null;
  /** null = the vehicle can be dispatched; otherwise the reason it can't. */
  dispatchBlockedReason: string | null;
  simulationOn: boolean;
  onPreview: (tripId: string | null) => void;
  onDispatch: (tripId: string) => void;
};

export function UpcomingTrips({
  trips,
  previewTripId,
  dispatchBlockedReason,
  simulationOn,
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
    <ul className="space-y-3">
      {trips.map((trip) => {
        const previewing = previewTripId === trip.id;
        const confirming = confirmingId === trip.id;

        return (
          <li
            key={trip.id}
            className={cn(
              "rounded-xl border bg-card p-3",
              previewing && "border-primary ring-1 ring-primary",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">
                  {trip.phase === "overdue" ? "Overdue" : "Upcoming"} ·{" "}
                  {trip.label}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDay(trip.scheduledAt)} · {formatTime(trip.scheduledAt)}
                </p>
              </div>
              <p className="text-right text-xs text-muted-foreground">
                {pluralize(trip.stops.length, "stop")}
                <br />
                {formatCurrency(getTripValue(trip.stops))}
              </p>
            </div>

            <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
              {trip.stops.map((stop) => stop.name).join(" → ")}
            </p>

            <div className="mt-3 flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => onPreview(previewing ? null : trip.id)}
              >
                {previewing ? (
                  <EyeOff className="size-3.5" />
                ) : (
                  <Eye className="size-3.5" />
                )}
                {previewing ? "Hide on map" : "Preview"}
              </Button>

              {trip.phase === "overdue" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="ml-auto"
                  render={<Link href="/panel/deliveries" />}
                >
                  Reschedule in Deliveries
                </Button>
              ) : confirming ? (
                <div className="ml-auto flex items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmingId(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setConfirmingId(null);
                      onDispatch(trip.id);
                    }}
                  >
                    Confirm dispatch
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  className="ml-auto gap-1.5"
                  disabled={dispatchBlockedReason !== null}
                  title={dispatchBlockedReason ?? undefined}
                  onClick={() => setConfirmingId(trip.id)}
                >
                  <Send className="size-3.5" />
                  Dispatch
                </Button>
              )}
            </div>
          </li>
        );
      })}

      {dispatchBlockedReason ? (
        <li className="text-xs text-muted-foreground">
          Can&rsquo;t dispatch: {dispatchBlockedReason}.
        </li>
      ) : simulationOn ? (
        <li className="text-xs text-violet-700 dark:text-violet-300">
          Simulation mode: dispatching here is not saved.
        </li>
      ) : null}
    </ul>
  );
}
