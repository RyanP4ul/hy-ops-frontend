"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Action, BookingContext } from "../types";
import { BookingCard } from "./booking-card";
import { LalamoveLiveMap } from "./lalamove-live-map";
import { dateLabel, warehouseAddress, words } from "./shared";

export function MultiStopBookingView({
  data,
  busy,
  action,
  now,
}: {
  data: BookingContext;
  busy: boolean;
  action: Action;
  now: number;
}) {
  const { booking, warehouse, history, can_reconcile } = data;
  const stops = booking.stops ?? [];

  return (
    <div className="space-y-5">
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-5">
          <LalamoveLiveMap booking={booking} warehouse={warehouse} />

          {/* Route timeline */}
          <section className="overflow-hidden rounded-xl border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold tracking-tight">
                  Multi-stop route
                </h2>
                <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                  {stops.length || booking.stop_count || 1}{" "}
                  {(stops.length || booking.stop_count || 1) === 1
                    ? "stop"
                    : "stops"}
                </span>
                {booking.is_route_optimized && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                    <Sparkles className="size-3" aria-hidden="true" />
                    Route optimized
                  </span>
                )}
              </div>
            </div>

            <div className="p-5">
              <div className="relative space-y-5 pl-7">
                <div
                  aria-hidden="true"
                  className="absolute top-2 bottom-2 left-[9px] w-px bg-border"
                />

                {/* Pickup */}
                <div className="relative">
                  <span
                    aria-hidden="true"
                    className="absolute top-1 -left-7 flex size-5 items-center justify-center rounded-full border-2 border-foreground bg-background text-[10px] font-bold"
                  >
                    P
                  </span>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Pickup
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-foreground">
                    {warehouse?.name || "Warehouse pickup"}
                  </p>
                  <p className="mt-0.5 break-words text-xs leading-relaxed text-muted-foreground">
                    {booking.pickup_address ||
                      (warehouse ? warehouseAddress(warehouse) : "") ||
                      "Pickup address unavailable"}
                  </p>
                  {warehouse?.phone_number && (
                    <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                      {warehouse.phone_number}
                    </p>
                  )}
                </div>

                {/* Drop-off stops */}
                <ol aria-label="Drop-off stops" className="space-y-5">
                  {stops.map((stop) => {
                    const delivered =
                      Boolean(stop.delivered_at) ||
                      stop.pod_status === "DELIVERED" ||
                      stop.pod_status === "SIGNED" ||
                      stop.order_status === "COMPLETED";
                    return (
                      <li key={stop.id} className="relative">
                        <span
                          aria-hidden="true"
                          className={cn(
                            "absolute top-0.5 -left-7 flex size-5 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums",
                            delivered
                              ? "bg-emerald-600 text-white"
                              : "bg-orange-600 text-white",
                          )}
                        >
                          {stop.stop_index}
                        </span>

                        <div className="rounded-lg border bg-background/60 p-3.5">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <Link
                                  href={`/panel/lalamove?orderId=${stop.order_id}`}
                                  className="inline-flex items-center gap-1 text-sm font-semibold text-foreground underline-offset-4 hover:underline"
                                >
                                  {stop.order_number}
                                  <ArrowRight
                                    className="size-3 text-muted-foreground"
                                    aria-hidden="true"
                                  />
                                </Link>
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                                    delivered
                                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                      : "bg-muted text-muted-foreground",
                                  )}
                                >
                                  {delivered ? (
                                    <CheckCircle2
                                      className="size-3"
                                      aria-hidden="true"
                                    />
                                  ) : (
                                    <Clock
                                      className="size-3"
                                      aria-hidden="true"
                                    />
                                  )}
                                  {words(stop.order_status)}
                                </span>
                              </div>

                              <p className="mt-1 text-xs font-medium text-foreground">
                                {stop.recipient_name}{" "}
                                <span className="font-normal tabular-nums text-muted-foreground">
                                  · {stop.recipient_phone}
                                </span>
                              </p>
                              <p className="mt-0.5 break-words text-xs leading-relaxed text-muted-foreground">
                                {stop.dropoff_address}
                              </p>
                            </div>

                            <div className="text-right text-xs">
                              {stop.pod_status && (
                                <p className="font-medium text-foreground">
                                  POD: {words(stop.pod_status)}
                                </p>
                              )}
                              {stop.delivered_at && (
                                <p className="mt-0.5 tabular-nums text-muted-foreground">
                                  {dateLabel(stop.delivered_at)}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>
          </section>

          {/* Activity log */}
          {!!history.length && (
            <section className="overflow-hidden rounded-xl border bg-card">
              <div className="flex items-center justify-between border-b px-5 py-3.5">
                <h2 className="text-sm font-semibold tracking-tight">
                  Activity
                </h2>
                <span className="text-xs text-muted-foreground">
                  Manila time
                </span>
              </div>
              <ol className="divide-y px-5">
                {history.map((event) => (
                  <li
                    key={event.id}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {event.event_type === "HYOPS_PROVIDER_SYNC"
                          ? "Delivery details updated"
                          : words(event.event_type)}
                      </p>
                      {event.last_error && (
                        <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
                          {event.last_error}
                        </p>
                      )}
                    </div>
                    <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {dateLabel(event.created_at)} · {words(event.state)}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>

        <aside
          aria-label="Courier booking"
          className="min-w-0 scroll-mt-4 lg:sticky lg:top-6"
        >
          <BookingCard
            booking={booking}
            busy={busy}
            action={action}
            canReconcile={can_reconcile}
            now={now}
          />
        </aside>
      </div>
    </div>
  );
}
