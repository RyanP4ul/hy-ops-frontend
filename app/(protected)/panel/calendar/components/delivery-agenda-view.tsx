"use client";

import Link from "next/link";
import { addDays, format, isSameDay, startOfDay } from "date-fns";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Navigation,
  Package,
  RotateCcw,
  Truck,
  User,
  Warehouse,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DAILY_STOP_CAPACITY,
  calendarEventKey,
  deliveryEffectiveStatusLabel,
  getDeliveryEffectiveStatus,
  getDeliveryStopStats,
} from "@/lib/delivery-calendar";
import type { CalendarEventResponse } from "@/schema/calendar";
import { formatTimeRange } from "@/utils/date-util";
import { useCalendar } from "../provider";
import {
  CATEGORY_LABELS,
  DELIVERY_STATUS_STYLES,
  MANUAL_CATEGORY_STYLES,
} from "./styles";

type DeliveryAgendaViewProps = {
  onSelectDelivery: (deliveryId: number) => void;
  onEditEvent: (event: CalendarEventResponse) => void;
  onOpenDay: (day: Date) => void;
};

export function DeliveryAgendaView({
  onSelectDelivery,
  onEditEvent,
  onOpenDay,
}: DeliveryAgendaViewProps) {
  const {
    calendarDays,
    filteredEvents,
    dailyDeliveryStats,
    now,
    nowMs,
    hasActiveFilters,
    resetFilters,
  } = useCalendar();

  const groupedDays = calendarDays.map((day) => {
    const dayStart = startOfDay(day);
    const dayEnd = startOfDay(addDays(day, 1));
    const dateKey = format(day, "yyyy-MM-dd");
    const items = filteredEvents
      .filter(
        (event) => event.end_time > dayStart && event.start_time < dayEnd,
      )
      .sort(
        (a, b) =>
          a.start_time.getTime() - b.start_time.getTime() ||
          Number(Boolean(b.delivery)) - Number(Boolean(a.delivery)),
      );
    return {
      day,
      dateKey,
      isToday: isSameDay(day, now),
      isSunday: day.getDay() === 0,
      load: dailyDeliveryStats.get(dateKey),
      items,
    };
  });

  const totalItems = groupedDays.reduce(
    (sum, group) => sum + group.items.length,
    0,
  );

  if (totalItems === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Truck className="size-6 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-semibold">
            No deliveries or events scheduled this week
          </h2>
          <p className="max-w-md text-sm text-muted-foreground">
            {hasActiveFilters
              ? "Try clearing one or more active filters to see all scheduled delivery runs."
              : "Schedule a new delivery run or navigate to another week to inspect dispatch plans."}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          {hasActiveFilters && (
            <Button type="button" variant="outline" onClick={resetFilters}>
              Reset filters
            </Button>
          )}
          <Button
            nativeButton={false}
            render={<Link href="/panel/delivery-schedules" />}
          >
            Schedule Delivery
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="divide-y">
      {groupedDays.map(({ day, dateKey, isToday, isSunday, load, items }) => (
        <section key={dateKey} className="p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => onOpenDay(day)}
                className="flex items-center gap-2.5 rounded-lg text-left transition hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span
                  className={`flex size-9 items-center justify-center rounded-full text-sm font-semibold ${
                    isToday
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {format(day, "d")}
                </span>
                <div>
                  <h2 className="text-sm font-semibold sm:text-base">
                    {format(day, "EEEE, MMMM d")}
                    {isToday && (
                      <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                        Today
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {isSunday
                      ? "Sunday · Standard scheduling closed"
                      : load
                        ? `${load.runs} ${load.runs === 1 ? "run" : "runs"} · ${load.stops}/${DAILY_STOP_CAPACITY} daily stops${load.pickups > 0 ? ` · ${load.pickups} ${load.pickups === 1 ? "pickup" : "pickups"}` : ""}`
                        : `0/${DAILY_STOP_CAPACITY} daily stops`}
                  </p>
                </div>
              </button>
            </div>

            {load && (
              <div className="flex flex-wrap items-center gap-1.5">
                {load.overdue > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="size-3" aria-hidden="true" />
                    {load.overdue} overdue
                  </Badge>
                )}
                {load.inTransit > 0 && (
                  <Badge
                    variant="outline"
                    className="border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                  >
                    {load.inTransit} active
                  </Badge>
                )}
                <Badge
                  variant="outline"
                  className={
                    load.stops >= DAILY_STOP_CAPACITY
                      ? "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200"
                      : ""
                  }
                >
                  {load.stops >= DAILY_STOP_CAPACITY
                    ? `Full (${load.stops}/${DAILY_STOP_CAPACITY})`
                    : `${load.stops}/${DAILY_STOP_CAPACITY} stops`}
                </Badge>
              </div>
            )}
          </div>

          {items.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3.5 py-2.5 text-xs text-muted-foreground">
              No matching deliveries or events on this day.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {items.map((event) => {
                if (event.delivery) {
                  const delivery = event.delivery;
                  const effectiveStatus = getDeliveryEffectiveStatus(
                    delivery,
                    nowMs,
                  );
                  const style = DELIVERY_STATUS_STYLES[effectiveStatus];
                  const stats = getDeliveryStopStats(delivery);
                  const departureLabel = `Departure ${format(event.start_time, "h:mm a")}`;
                  const isTrackable =
                    delivery.status === "in_transit" ||
                    delivery.status === "returning";

                  return (
                    <li
                      key={calendarEventKey(event)}
                      className={`group rounded-xl border border-l-4 bg-card transition hover:shadow-sm ${style.accent} ${
                        delivery.status === "cancelled"
                          ? "border-dashed opacity-75"
                          : ""
                      }`}
                    >
                      <div className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between">
                        <button
                          type="button"
                          aria-label={`View ${event.title}, ${departureLabel}`}
                          onClick={() => onSelectDelivery(delivery.id)}
                          className="flex min-w-0 flex-1 flex-col gap-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:flex-row sm:items-center sm:gap-4"
                        >
                          <div className="flex shrink-0 items-center gap-2 sm:w-32 sm:flex-col sm:items-start sm:gap-1">
                            <span className="inline-flex items-center gap-1.5 text-sm font-semibold tabular-nums">
                              <Clock3
                                className="size-3.5 text-muted-foreground"
                                aria-hidden="true"
                              />
                              {format(event.start_time, "h:mm a")}
                            </span>
                            <Badge variant="outline" className={style.badge}>
                              {deliveryEffectiveStatusLabel[effectiveStatus]}
                            </Badge>
                          </div>

                          <div className="min-w-0 flex-1 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                              <span className="font-semibold">
                                Delivery #{delivery.id}
                              </span>
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                                <Truck className="size-3.5" aria-hidden="true" />
                                {delivery.vehicle}
                              </span>
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                <User className="size-3.5" aria-hidden="true" />
                                {delivery.driver}
                              </span>
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                <Warehouse
                                  className="size-3.5"
                                  aria-hidden="true"
                                />
                                {delivery.warehouse}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="inline-flex items-center gap-1 font-medium text-foreground/85">
                                <Package
                                  className="size-3.5 text-muted-foreground"
                                  aria-hidden="true"
                                />
                                {stats.total}{" "}
                                {stats.total === 1 ? "stop" : "stops"}
                                {stats.total > 0 && (
                                  <span className="text-muted-foreground">
                                    ({stats.delivered}/{stats.total} delivered)
                                  </span>
                                )}
                              </span>
                              {stats.delivered === stats.total &&
                                stats.total > 0 && (
                                  <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                                    <CheckCircle2
                                      className="size-3.5"
                                      aria-hidden="true"
                                    />
                                    All stops delivered
                                  </span>
                                )}
                              {stats.failed > 0 && (
                                <span className="inline-flex items-center gap-1 font-medium text-rose-700 dark:text-rose-400">
                                  <XCircle
                                    className="size-3.5"
                                    aria-hidden="true"
                                  />
                                  {stats.failed} failed
                                </span>
                              )}
                              {stats.pickups > 0 && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 font-medium text-violet-800 dark:text-violet-300">
                                  <RotateCcw
                                    className="size-3"
                                    aria-hidden="true"
                                  />
                                  +{stats.pickups} return{" "}
                                  {stats.pickups === 1 ? "pickup" : "pickups"}
                                </span>
                              )}
                            </div>

                            {delivery.orders.length > 0 && (
                              <p className="truncate text-xs text-muted-foreground">
                                {delivery.orders
                                  .slice(0, 3)
                                  .map(
                                    (order) =>
                                      `${order.orderNumber}${order.recipient ? ` (${order.recipient})` : ""}`,
                                  )
                                  .join(" · ")}
                                {delivery.orders.length > 3
                                  ? ` · +${delivery.orders.length - 3} more`
                                  : ""}
                              </p>
                            )}
                          </div>
                        </button>

                        <div className="flex shrink-0 items-center gap-2">
                          {isTrackable && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8"
                              nativeButton={false}
                              render={<Link href="/panel/fleet-map" />}
                            >
                              <Navigation
                                className="mr-1.5 size-3.5"
                                aria-hidden="true"
                              />
                              Track
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-8"
                            onClick={() => onSelectDelivery(delivery.id)}
                          >
                            Details
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                }

                // Manual calendar note / operational event (visually quieter)
                const manualStyle =
                  MANUAL_CATEGORY_STYLES[event.category as CalendarCategory] ??
                  MANUAL_CATEGORY_STYLES.OTHER;
                const timeRange = formatTimeRange(
                  event.start_time,
                  event.end_time,
                );

                return (
                  <li key={calendarEventKey(event)}>
                    <button
                      type="button"
                      aria-label={`Edit ${event.title}, ${timeRange}`}
                      onClick={() => onEditEvent(event)}
                      className={`flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-l-[3px] px-3.5 py-2.5 text-left text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${manualStyle.card} ${manualStyle.accent}`}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <CalendarDays
                          className="size-4 shrink-0 opacity-70"
                          aria-hidden="true"
                        />
                        <span className="truncate font-medium">
                          {event.title}
                        </span>
                        <Badge
                          variant="outline"
                          className="shrink-0 text-[10px] font-normal"
                        >
                          {CATEGORY_LABELS[event.category as CalendarCategory] ??
                            event.category.replaceAll("_", " ")}
                        </Badge>
                      </div>
                      <span className="text-xs tabular-nums opacity-80">
                        {timeRange}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
