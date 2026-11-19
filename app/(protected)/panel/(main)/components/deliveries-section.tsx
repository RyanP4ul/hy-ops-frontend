"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { parseLocalDateTime } from "@/utils/date-util";

export type ActiveDeliveryRow = {
  run: string;
  customer: string;
  destination: string;
  driver: string;
  status: string;
  progress: string;
};

export type UpcomingDeliveryRow = {
  run: string;
  date: string;
  time: string;
  customer: string;
  destination: string;
  driver: string;
};

function StatusLabel({ status }: { status: string }) {
  const key = status.toUpperCase();
  const dotColors: Record<string, string> = {
    SCHEDULED: "bg-amber-500",
    IN_TRANSIT: "bg-blue-500",
    RETURNING: "bg-violet-500",
    COMPLETED: "bg-emerald-500",
    DELIVERED: "bg-emerald-500",
    CANCELLED: "bg-destructive",
  };
  const label = key
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase());

  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${dotColors[key] ?? "bg-muted-foreground"}`}
      />
      {label}
    </span>
  );
}

export function DeliveriesSection({
  activeDeliveries,
  upcomingDeliveries,
}: {
  activeDeliveries: ActiveDeliveryRow[];
  upcomingDeliveries: UpcomingDeliveryRow[];
}) {
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const availableStatuses = useMemo(() => {
    const unique = new Set(activeDeliveries.map((d) => d.status.toUpperCase()));
    return Array.from(unique);
  }, [activeDeliveries]);

  const filteredActive = useMemo(() => {
    if (statusFilter === "ALL") return activeDeliveries;
    return activeDeliveries.filter(
      (d) => d.status.toUpperCase() === statusFilter,
    );
  }, [activeDeliveries, statusFilter]);

  return (
    <section
      aria-label="Deliveries"
      className="grid min-w-0 overflow-hidden rounded-xl border bg-card lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:divide-x"
    >
      {/* Active deliveries */}
      <div className="flex min-w-0 flex-col">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3.5">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold tracking-tight">
              Active deliveries
            </h2>
            <span className="text-xs tabular-nums text-muted-foreground">
              {activeDeliveries.length}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {availableStatuses.length > 1 && (
              <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
                {["ALL", ...availableStatuses].map((status) => {
                  const selected = statusFilter === status;
                  const label =
                    status === "ALL"
                      ? "All"
                      : status
                          .toLowerCase()
                          .replace(/_/g, " ")
                          .replace(/^./, (c) => c.toUpperCase());
                  return (
                    <button
                      key={status}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setStatusFilter(status)}
                      className={[
                        "rounded-md px-2 py-0.5 text-xs font-medium transition-colors",
                        selected
                          ? "bg-background text-foreground shadow-2xs"
                          : "text-muted-foreground hover:text-foreground",
                      ].join(" ")}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            <Link
              href="/panel/deliveries"
              className="inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              View all
              <ArrowUpRight aria-hidden="true" className="size-3.5" />
            </Link>
          </div>
        </div>

        <div className="flex-1 p-5">
          {!filteredActive.length ? (
            <div className="flex min-h-36 flex-col items-center justify-center text-center">
              <p className="text-sm font-medium">No active deliveries</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Scheduled and en-route runs will appear here.
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {filteredActive.map((delivery) => (
                <li key={delivery.run} className="py-3.5 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {delivery.customer}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {delivery.run} · {delivery.driver} ·{" "}
                        {delivery.destination}
                      </p>
                    </div>
                    <StatusLabel status={delivery.status} />
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {delivery.progress}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Upcoming departures */}
      <div className="flex min-w-0 flex-col border-t lg:border-t-0">
        <div className="flex items-center justify-between gap-2 border-b px-5 py-3.5">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold tracking-tight">
              Upcoming departures
            </h2>
            <span className="text-xs tabular-nums text-muted-foreground">
              {upcomingDeliveries.length}
            </span>
          </div>

          <Link
            href="/panel/delivery-schedules"
            className="inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            Schedule
            <ArrowUpRight aria-hidden="true" className="size-3.5" />
          </Link>
        </div>

        <div className="flex-1 p-5">
          {!upcomingDeliveries.length ? (
            <div className="flex min-h-36 flex-col items-center justify-center text-center">
              <p className="text-sm font-medium">No upcoming departures</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Next scheduled runs will appear here.
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {upcomingDeliveries.map((delivery) => {
                const departure = parseLocalDateTime(
                  delivery.date,
                  delivery.time,
                );
                return (
                  <li
                    key={delivery.run}
                    className="flex items-start gap-3 py-3.5 first:pt-0 last:pb-0"
                  >
                    <div
                      aria-hidden="true"
                      className="flex w-11 shrink-0 flex-col items-center rounded-lg bg-muted/60 py-1.5 text-center"
                    >
                      <span className="text-[10px] font-medium uppercase text-muted-foreground">
                        {departure.toLocaleDateString("en-PH", {
                          month: "short",
                        })}
                      </span>
                      <span className="text-base font-semibold leading-tight tabular-nums">
                        {departure.getDate()}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-foreground">
                          {delivery.customer}
                        </p>
                        <time
                          dateTime={`${delivery.date}T${delivery.time}+08:00`}
                          className="shrink-0 text-xs font-medium tabular-nums text-foreground"
                        >
                          {departure.toLocaleTimeString("en-PH", {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </time>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {delivery.run} · {delivery.driver} ·{" "}
                        {delivery.destination}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
