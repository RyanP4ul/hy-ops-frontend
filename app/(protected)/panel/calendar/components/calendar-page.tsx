"use client";

import * as React from "react";
import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  AlertTriangle,
  CalendarDays,
  Clock3,
  Package,
  RotateCcw,
  Truck,
  User,
} from "lucide-react";

import { DeliveryCalendarDetails } from "@/components/delivery-calendar-details";
import { useModal } from "@/components/providers/modal-provider";
import { Button } from "@/components/ui/button";
import { layoutOverlappingEvents } from "@/lib/calendar-layout";
import {
  DAILY_STOP_CAPACITY,
  calendarEventKey,
  getCalendarEventVisualEndTime,
  getDeliveryEffectiveStatus,
  getDeliveryStopStats,
} from "@/lib/delivery-calendar";
import type { CalendarEventResponse } from "@/schema/calendar";
import { DialogMode } from "@/types/dialog";
import { formatTimeRange } from "@/utils/date-util";
import { useCalendar } from "../provider";
import Control from "./control";
import { DeliveryAgendaView } from "./delivery-agenda-view";
import { DeliverySummaryStrip } from "./delivery-summary-strip";
import Filters from "./filters";
import {
  DELIVERY_STATUS_STYLES,
  MANUAL_CATEGORY_STYLES,
} from "./styles";
import type { DeliveryEffectiveStatus } from "@/lib/delivery-calendar";

const LEGEND_STATUSES: DeliveryEffectiveStatus[] = [
  "scheduled",
  "overdue",
  "in_transit",
  "returning",
  "completed",
  "cancelled",
];

const START_HOUR = 0;
const END_HOUR = 24;
const HOUR_HEIGHT = 68;
const DELIVERY_CARD_MIN_HEIGHT = 56;
const HOURS = Array.from(
  { length: END_HOUR - START_HOUR },
  (_, index) => START_HOUR + index,
);

function atTime(day: Date, hour: number, minute = 0) {
  const date = new Date(day);
  date.setHours(hour, minute, 0, 0);
  return date;
}

export default function CalendarPage() {
  const {
    eventQuery,
    deliveryQuery,
    filteredEvents,
    dailyDeliveryStats,
    view,
    setView,
    selectedDate,
    setSelectedDate,
    calendarDays,
    now,
    nowMs,
    setSelected,
  } = useCalendar();
  const { openModal } = useModal();

  const [selectedDeliveryId, setSelectedDeliveryId] = React.useState<
    number | null
  >(null);
  const timeGridScrollRef = React.useRef<HTMLDivElement>(null);

  const monthDays = React.useMemo(() => {
    const monthStart = startOfMonth(selectedDate);
    const monthEnd = endOfMonth(selectedDate);

    return eachDayOfInterval({
      start: startOfWeek(monthStart, { weekStartsOn: 1 }),
      end: endOfWeek(monthEnd, { weekStartsOn: 1 }),
    });
  }, [selectedDate]);

  const earliestVisibleHour = React.useMemo(() => {
    const firstDay = calendarDays[0];
    const lastDay = calendarDays[calendarDays.length - 1];
    if (!firstDay || !lastDay) return 6;

    const rangeStart = startOfDay(firstDay);
    const rangeEnd = startOfDay(addDays(lastDay, 1));
    let targetHour = 6;

    for (const event of filteredEvents) {
      if (event.end_time > rangeStart && event.start_time < rangeEnd) {
        const hour = event.start_time.getHours();
        if (hour < targetHour) targetHour = hour;
      }
    }
    return targetHour;
  }, [calendarDays, filteredEvents]);

  // Auto-scroll Week/Day time grid to working hours (6:00 AM) or the earliest visible run.
  React.useEffect(() => {
    if (view !== "Week" && view !== "Day") return;
    const container = timeGridScrollRef.current;
    if (!container) return;

    const scrollTop = Math.max(0, (earliestVisibleHour - 0.5) * HOUR_HEIGHT);
    container.scrollTo({ top: scrollTop, behavior: "auto" });
  }, [view, earliestVisibleHour]);

  function showDay(day: Date) {
    setSelectedDate(day);
    setView("Day");
  }

  function openManualEventEditor(event: CalendarEventResponse) {
    setSelected({ id: Number(event.id), version: event.version });
    openModal(DialogMode.EDIT, {
      title: "Edit Event",
      description: "Edit the details of your event",
      action: "Save",
    });
  }

  function renderEventCard(
    event: CalendarEventResponse,
    compact = false,
    dense = false,
  ) {
    if (event.delivery) {
      const delivery = event.delivery;
      const effectiveStatus = getDeliveryEffectiveStatus(delivery, nowMs);
      const style = DELIVERY_STATUS_STYLES[effectiveStatus];
      const stats = getDeliveryStopStats(delivery);
      const eventTime = `Departure ${format(event.start_time, "h:mm a")}`;

      return (
        <button
          key={calendarEventKey(event)}
          type="button"
          title={`${event.title} · ${delivery.driver} · ${delivery.warehouse} · ${eventTime}`}
          aria-label={`View ${event.title}, ${eventTime}`}
          onClick={() => setSelectedDeliveryId(delivery.id)}
          className={`h-full w-full overflow-clip rounded-md border border-l-[3px] text-left shadow-xs transition hover:shadow-md focus-visible:z-30 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring ${style.card} ${style.accent} ${
            delivery.status === "cancelled" ? "border-dashed opacity-75" : ""
          } ${compact ? "px-2 py-1.5 text-xs" : dense ? "px-2 py-1 text-[11px]" : "p-2 text-xs"}`}
        >
          <div className="flex items-center gap-1">
            {effectiveStatus === "overdue" ? (
              <AlertTriangle
                className="size-3 shrink-0 text-rose-700 dark:text-rose-300"
                aria-hidden="true"
              />
            ) : (
              <Truck className="size-3 shrink-0 opacity-80" aria-hidden="true" />
            )}
            <span className="block truncate font-semibold leading-4">
              {event.title}
            </span>
          </div>

          <div className="mt-0.5 flex items-center justify-between gap-1 text-[11px] opacity-90">
            <span className="inline-flex min-w-0 items-center gap-1 truncate">
              <Clock3 className="size-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{eventTime}</span>
            </span>
            {effectiveStatus === "overdue" && (
              <span className="shrink-0 rounded bg-rose-600 px-1 py-0.25 text-[10px] font-semibold text-white">
                Overdue
              </span>
            )}
          </div>

          {!compact && (
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] opacity-85">
              <span className="inline-flex min-w-0 items-center gap-1 truncate">
                <User className="size-3 shrink-0" aria-hidden="true" />
                <span className="truncate">{delivery.driver}</span>
              </span>
              <span className="inline-flex shrink-0 items-center gap-1">
                <Package className="size-3 shrink-0" aria-hidden="true" />
                {stats.total > 0
                  ? `${stats.delivered}/${stats.total}`
                  : "0 stops"}
              </span>
              {stats.pickups > 0 && (
                <span className="inline-flex shrink-0 items-center gap-0.5 font-medium">
                  <RotateCcw className="size-2.5 shrink-0" aria-hidden="true" />
                  +{stats.pickups}
                </span>
              )}
            </div>
          )}

          {compact && (
            <div className="mt-0.5 flex items-center justify-between gap-1 text-[10px] opacity-80">
              <span className="truncate">{delivery.driver}</span>
              <span className="shrink-0 tabular-nums">
                {stats.total > 0
                  ? `${stats.delivered}/${stats.total} stops`
                  : stats.pickups > 0
                    ? `${stats.pickups} pickup${stats.pickups === 1 ? "" : "s"}`
                    : "0 stops"}
              </span>
            </div>
          )}
        </button>
      );
    }

    // Manual calendar note / operational event (visually subdued vs live deliveries)
    const style =
      MANUAL_CATEGORY_STYLES[event.category as CalendarCategory] ??
      MANUAL_CATEGORY_STYLES.OTHER;
    const eventTime = formatTimeRange(event.start_time, event.end_time);

    return (
      <button
        key={calendarEventKey(event)}
        type="button"
        title={`${event.title} · ${eventTime}`}
        aria-label={`Edit ${event.title}, ${eventTime}`}
        onClick={() => openManualEventEditor(event)}
        className={`h-full w-full overflow-clip rounded-md border border-dashed border-l-[3px] text-left transition hover:shadow-sm focus-visible:z-30 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring ${style.card} ${style.accent} ${
          compact
            ? "px-2 py-1 text-xs"
            : dense
              ? "px-1.5 py-0.5 text-[11px]"
              : "p-2 text-xs"
        }`}
      >
        <div className="flex items-center gap-1">
          <CalendarDays
            className="size-3 shrink-0 opacity-65"
            aria-hidden="true"
          />
          <span
            className={`block truncate font-medium ${dense ? "leading-4" : "leading-5"}`}
          >
            {event.title}
          </span>
        </div>
        {!compact && !dense && (
          <span className="mt-1 flex items-center gap-1 text-[11px] opacity-75">
            <Clock3 className="size-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{eventTime}</span>
          </span>
        )}
      </button>
    );
  }

  const isInitialLoading = deliveryQuery.isPending && eventQuery.isPending;

  return (
    <div className="w-full min-w-0 space-y-5 text-foreground">
      <DeliveryCalendarDetails
        delivery={deliveryQuery.data?.find(
          (delivery) => delivery.id === selectedDeliveryId,
        )}
        onClose={() => setSelectedDeliveryId(null)}
      />

      {deliveryQuery.isError && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm"
        >
          <span>Unable to load deliveries.</span>
          <Button
            variant="outline"
            size="sm"
            disabled={deliveryQuery.isFetching}
            onClick={() => void deliveryQuery.refetch()}
          >
            Retry deliveries
          </Button>
        </div>
      )}

      {eventQuery.isError && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm"
        >
          <span>
            {eventQuery.data
              ? "Unable to refresh. Showing the last loaded events."
              : "Unable to load calendar events."}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={eventQuery.isFetching}
            onClick={() => void eventQuery.refetch()}
          >
            Retry
          </Button>
        </div>
      )}

      <Control />

      <DeliverySummaryStrip />

      <Filters />

      <div className="overflow-clip rounded-xl border bg-background shadow-sm">
        {isInitialLoading ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center text-sm text-muted-foreground">
            <progress
              aria-label="Loading delivery calendar"
              className="h-1.5 w-40 overflow-clip rounded-full"
            />
            <span>Loading delivery schedule…</span>
          </div>
        ) : view === "Agenda" ? (
          <DeliveryAgendaView
            onSelectDelivery={setSelectedDeliveryId}
            onEditEvent={openManualEventEditor}
            onOpenDay={showDay}
          />
        ) : view === "Month" ? (
          <div className="overflow-x-auto">
            <div className="min-w-[860px]">
              <div className="grid grid-cols-7 border-b bg-muted/20">
                {[
                  "Monday",
                  "Tuesday",
                  "Wednesday",
                  "Thursday",
                  "Friday",
                  "Saturday",
                  "Sunday",
                ].map((day) => (
                  <div
                    key={day}
                    className="border-r px-3 py-3 text-center text-xs font-medium text-muted-foreground last:border-r-0"
                  >
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {monthDays.map((day) => {
                  const dayStart = startOfDay(day);
                  const dayEnd = startOfDay(addDays(day, 1));
                  const dateKey = format(day, "yyyy-MM-dd");
                  const load = dailyDeliveryStats.get(dateKey);
                  const isSunday = day.getDay() === 0;
                  const dayEvents = filteredEvents
                    .filter(
                      (event) =>
                        event.end_time > dayStart && event.start_time < dayEnd,
                    )
                    .sort(
                      (a, b) =>
                        Number(Boolean(b.delivery)) -
                          Number(Boolean(a.delivery)) ||
                        a.start_time.getTime() - b.start_time.getTime(),
                    );

                  return (
                    <div
                      key={dateKey}
                      className={`min-h-36 border-b border-r p-2 last:border-r-0 ${
                        !isSameMonth(day, selectedDate)
                          ? "bg-muted/20 text-muted-foreground"
                          : isSunday
                            ? "bg-muted/10"
                            : ""
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between gap-1">
                        <div className="min-w-0">
                          {load ? (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums ${
                                load.overdue > 0
                                  ? "bg-rose-500/15 text-rose-800 dark:text-rose-200"
                                  : load.stops >= DAILY_STOP_CAPACITY
                                    ? "bg-amber-500/15 text-amber-900 dark:text-amber-200"
                                    : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {load.runs}r · {load.stops}/{DAILY_STOP_CAPACITY}
                            </span>
                          ) : isSunday ? (
                            <span className="text-[10px] text-muted-foreground/70">
                              Closed
                            </span>
                          ) : null}
                        </div>

                        <button
                          type="button"
                          onClick={() => showDay(day)}
                          aria-label={`Show events for ${format(day, "MMMM d, yyyy")}`}
                          className={`flex size-7 shrink-0 items-center justify-center rounded-full text-sm transition hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring ${
                            isSameDay(day, now)
                              ? "bg-slate-900 font-semibold text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900"
                              : ""
                          }`}
                        >
                          {format(day, "d")}
                        </button>
                      </div>

                      <div className="space-y-1">
                        {dayEvents
                          .slice(0, 3)
                          .map((event) => renderEventCard(event, true))}
                        {dayEvents.length > 3 && (
                          <button
                            type="button"
                            onClick={() => showDay(day)}
                            className="w-full rounded px-1.5 py-1 text-left text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                            aria-label={`View ${dayEvents.length - 3} more events on ${format(day, "MMMM d")}`}
                          >
                            +{dayEvents.length - 3} more
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div
            ref={timeGridScrollRef}
            className="max-h-[72dvh] overflow-auto overscroll-contain [scrollbar-gutter:stable]"
          >
            <div
              className="min-w-[620px]"
              style={{
                minWidth:
                  view === "Week"
                    ? `${84 + calendarDays.length * 196}px`
                    : "620px",
              }}
            >
              {/* Sticky Day headers with daily delivery load pills */}
              <div
                className="sticky top-0 z-30 grid border-b bg-background/95 backdrop-blur-xs"
                style={{
                  gridTemplateColumns: `84px repeat(${calendarDays.length}, minmax(${view === "Week" ? "196px" : "0"}, 1fr))`,
                }}
              >
                <div className="flex items-center justify-center border-r px-2 py-3 text-xs font-medium text-muted-foreground">
                  PHT (UTC+8)
                </div>
                {calendarDays.map((day) => {
                  const dateKey = format(day, "yyyy-MM-dd");
                  const load = dailyDeliveryStats.get(dateKey);
                  const isSunday = day.getDay() === 0;

                  return (
                    <button
                      key={dateKey}
                      type="button"
                      onClick={() => showDay(day)}
                      className="flex flex-col items-center gap-1 border-r px-2 py-2.5 text-center transition last:border-r-0 hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
                    >
                      <span
                        className={`flex size-8 items-center justify-center rounded-full text-base font-semibold leading-6 ${
                          isSameDay(day, now)
                            ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                            : ""
                        }`}
                      >
                        {format(day, "d")}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(day, "EEEE")}
                      </span>
                      {load ? (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums ${
                            load.overdue > 0
                              ? "bg-rose-500/15 text-rose-800 dark:text-rose-200"
                              : load.stops >= DAILY_STOP_CAPACITY
                                ? "bg-amber-500/15 text-amber-900 dark:text-amber-200"
                                : "bg-sky-500/10 text-sky-800 dark:text-sky-200"
                          }`}
                        >
                          {load.runs} {load.runs === 1 ? "run" : "runs"} ·{" "}
                          {load.stops}/{DAILY_STOP_CAPACITY} stops
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/70">
                          {isSunday ? "Sunday (closed)" : "No runs"}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Time slots and side-by-side cards */}
              <div
                className="grid"
                style={{
                  gridTemplateColumns: `84px repeat(${calendarDays.length}, minmax(${view === "Week" ? "196px" : "0"}, 1fr))`,
                }}
              >
                <div
                  className="relative border-r bg-muted/10"
                  style={{ height: HOURS.length * HOUR_HEIGHT }}
                >
                  {HOURS.map((hour, index) => (
                    <div
                      key={hour}
                      className="absolute right-0 z-10 -translate-y-1/2 px-3 text-xs font-medium text-muted-foreground"
                      style={{ top: index * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
                    >
                      {format(atTime(selectedDate, hour), "hh a")}
                    </div>
                  ))}
                </div>

                {calendarDays.map((day) => {
                  const dayStart = atTime(day, START_HOUR);
                  const dayEnd = atTime(day, END_HOUR);
                  const dayEvents = filteredEvents
                    .filter(
                      (event) =>
                        event.end_time > dayStart && event.start_time < dayEnd,
                    )
                    .sort(
                      (a, b) =>
                        a.start_time.getTime() - b.start_time.getTime(),
                    );
                  const positionedEvents = layoutOverlappingEvents(
                    dayEvents,
                    (event) => getCalendarEventVisualEndTime(event, 55),
                  );
                  const isCurrentDay = isSameDay(day, now);
                  const isNowInGrid = now >= dayStart && now < dayEnd;
                  const currentTimeTop =
                    ((now.getTime() - dayStart.getTime()) / 3_600_000) *
                    HOUR_HEIGHT;

                  return (
                    <div
                      key={format(day, "yyyy-MM-dd")}
                      className="relative border-r last:border-r-0"
                      style={{ height: HOURS.length * HOUR_HEIGHT }}
                    >
                      {HOURS.map((hour, index) => (
                        <div
                          key={hour}
                          className={`pointer-events-none absolute left-0 right-0 border-t border-border/75 ${
                            hour < 6 || hour >= 20 ? "bg-muted/15" : ""
                          }`}
                          style={{
                            top: index * HOUR_HEIGHT,
                            height: HOUR_HEIGHT,
                          }}
                        />
                      ))}

                      {isCurrentDay && isNowInGrid && (
                        <div
                          role="img"
                          aria-label="Current time"
                          className="pointer-events-none absolute left-0 right-0 z-20 border-t-2 border-rose-500"
                          style={{ top: currentTimeTop }}
                        >
                          <span className="absolute -left-1.5 -top-[5px] size-2.5 rounded-full bg-rose-500" />
                        </div>
                      )}

                      {positionedEvents.map(
                        ({ event, column, columnCount, columnSpan }) => {
                          const visibleStart = new Date(
                            Math.max(
                              event.start_time.getTime(),
                              dayStart.getTime(),
                            ),
                          );
                          const visibleEnd = new Date(
                            Math.min(
                              event.end_time.getTime(),
                              dayEnd.getTime(),
                            ),
                          );
                          const startMinutes =
                            (visibleStart.getTime() - dayStart.getTime()) /
                            60_000;
                          const durationMinutes =
                            (visibleEnd.getTime() - visibleStart.getTime()) /
                            60_000;
                          const gridHeight = HOURS.length * HOUR_HEIGHT;
                          const minHeight = event.delivery
                            ? DELIVERY_CARD_MIN_HEIGHT
                            : 28;
                          const rawHeight = Math.max(
                            (durationMinutes / 60) * HOUR_HEIGHT - 6,
                            minHeight,
                          );
                          const rawTop = (startMinutes / 60) * HOUR_HEIGHT + 3;
                          const top = Math.min(
                            rawTop,
                            Math.max(0, gridHeight - minHeight - 3),
                          );
                          const height = Math.min(
                            rawHeight,
                            Math.max(minHeight, gridHeight - top - 3),
                          );
                          const left = (column / columnCount) * 100;
                          const width = (columnSpan / columnCount) * 100;

                          return (
                            <div
                              key={calendarEventKey(event)}
                              className="absolute z-10"
                              style={{
                                top,
                                height,
                                left: `calc(${left}% + 3px)`,
                                width: `calc(${width}% - 6px)`,
                              }}
                            >
                              {renderEventCard(
                                event,
                                false,
                                !event.delivery && height < 56,
                              )}
                            </div>
                          );
                        },
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Quiet color legend so every status is immediately understandable */}
        <footer className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/80">Legend:</span>
          {LEGEND_STATUSES.map((status) => (
            <span key={status} className="inline-flex items-center gap-1.5">
              <span
                className={`size-2 rounded-full ${DELIVERY_STATUS_STYLES[status].dot}`}
                aria-hidden="true"
              />
              {DELIVERY_STATUS_STYLES[status].label}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-3.5 rounded-xs border border-dashed border-muted-foreground/60 bg-background"
              aria-hidden="true"
            />
            Manual note
          </span>
        </footer>
      </div>
    </div>
  );
}
