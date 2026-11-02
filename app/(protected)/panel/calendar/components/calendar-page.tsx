"use client";
import { DeliveryCalendarDetails } from "@/components/delivery-calendar-details";
import { calendarEventKey } from "@/lib/delivery-calendar";
import { layoutOverlappingEvents } from "@/lib/calendar-layout";

import * as React from "react";
import {
  addDays,
  addMonths,
  addWeeks,
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
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Filter,
  Plus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { manilaCalendarNow, formatTimeRange } from "@/utils/date-util";
import { useModal } from "@/components/providers/modal-provider";
import { DialogMode } from "@/types/dialog";
import { useCalendar } from "../provider";
import type { CalendarEventResponse } from "@/schema/calendar";

const START_HOUR = 0;
const END_HOUR = 24;
const HOUR_HEIGHT = 64;
const HOURS = Array.from(
  { length: END_HOUR - START_HOUR },
  (_, index) => START_HOUR + index,
);

type CalendarCategory =
  | "ORDER_FULFILLMENT"
  | "STAFF_SCHEDULE"
  | "DELIVERY"
  | "INVENTORY_WAREHOUSE"
  | "VEHICLE_MAINTENANCE"
  | "MEETING_APPOINTMENT"
  | "OTHER";

const CATEGORIES: CalendarCategory[] = [
  "ORDER_FULFILLMENT", "STAFF_SCHEDULE",
  "DELIVERY",
  "INVENTORY_WAREHOUSE",
  "VEHICLE_MAINTENANCE",
  "MEETING_APPOINTMENT",
  "OTHER",
];

const CATEGORY_STYLES: Record<
  CalendarCategory,
  { card: string; accent: string; dot: string; month: string }
> = {
  ORDER_FULFILLMENT: { card: "bg-orange-200 text-orange-950", accent: "border-orange-500", dot: "bg-orange-500", month: "bg-orange-500/10" },
  STAFF_SCHEDULE: { card: "bg-teal-200 text-teal-950", accent: "border-teal-500", dot: "bg-teal-500", month: "bg-teal-500/10" },
  DELIVERY: {
    card: "bg-amber-200 text-amber-950 hover:bg-amber-300",
    accent: "border-amber-500",
    dot: "bg-amber-500",
    month: "bg-amber-500/10 text-amber-900",
  },
  INVENTORY_WAREHOUSE: {
    card: "bg-lime-200 text-lime-950 hover:bg-lime-300",
    accent: "border-lime-500",
    dot: "bg-lime-500",
    month: "bg-lime-500/10 text-lime-900",
  },
  VEHICLE_MAINTENANCE: {
    card: "bg-violet-200 text-violet-950 hover:bg-violet-300",
    accent: "border-violet-500",
    dot: "bg-violet-500",
    month: "bg-violet-500/10 text-violet-900",
  },
  MEETING_APPOINTMENT: {
    card: "bg-sky-200 text-sky-950 hover:bg-sky-300",
    accent: "border-sky-500",
    dot: "bg-sky-500",
    month: "bg-sky-500/10 text-sky-900",
  },
  OTHER: {
    card: "bg-slate-200 text-slate-950 hover:bg-slate-300",
    accent: "border-slate-500",
    dot: "bg-slate-500",
    month: "bg-slate-500/10 text-slate-900",
  },
};

function atTime(day: Date, hour: number, minute = 0) {
  const date = new Date(day);
  date.setHours(hour, minute, 0, 0);
  return date;
}

export default function Page() {
  const {
    eventQuery,
    deliveryQuery,
    filteredEvents,
    view,
    setView,
    selectedDate,
    setSelectedDate,
    calendarDays,
    selectedCategories,
    setSelectedCategories,
    setSelected,
  } = useCalendar();
  const { openModal } = useModal();

  const [selectedDeliveryId, setSelectedDeliveryId] = React.useState<number | null>(null);
  const [datePickerOpen, setDatePickerOpen] = React.useState(false);
  const [now, setNow] = React.useState(() => manilaCalendarNow());

  // Keep the current-time marker fresh without forcing frequent rerenders.
  React.useEffect(() => {
    const intervalId = window.setInterval(() => setNow(manilaCalendarNow()), 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const monthDays = React.useMemo(() => {
    const monthStart = startOfMonth(selectedDate);
    const monthEnd = endOfMonth(selectedDate);

    return eachDayOfInterval({
      start: startOfWeek(monthStart, { weekStartsOn: 1 }),
      end: endOfWeek(monthEnd, { weekStartsOn: 1 }),
    });
  }, [selectedDate]);

  const visibleEventCount = React.useMemo(() => {
    const events = filteredEvents ?? [];
    let rangeStart: Date;
    let rangeEndExclusive: Date;

    if (view === "Day") {
      rangeStart = startOfDay(selectedDate);
      rangeEndExclusive = startOfDay(addDays(selectedDate, 1));
    } else if (view === "Week") {
      const firstDay =
        calendarDays[0] ?? startOfWeek(selectedDate, { weekStartsOn: 1 });
      const lastDay =
        calendarDays[calendarDays.length - 1] ??
        endOfWeek(selectedDate, { weekStartsOn: 1 });
      rangeStart = startOfDay(firstDay);
      rangeEndExclusive = startOfDay(addDays(lastDay, 1));
    } else {
      rangeStart = startOfMonth(selectedDate);
      rangeEndExclusive = startOfMonth(addMonths(selectedDate, 1));
    }

    // Count an event once if any part of it falls inside the current view.
    return events.filter(
      (event) =>
        event.end_time > rangeStart && event.start_time < rangeEndExclusive,
    ).length;
  }, [calendarDays, filteredEvents, selectedDate, view]);

  const heading = React.useMemo(() => {
    if (view === "Day") return format(selectedDate, "EEE, MMM d, yyyy");
    if (view === "Week") {
      const firstDay =
        calendarDays[0] ?? startOfWeek(selectedDate, { weekStartsOn: 1 });
      const lastDay =
        calendarDays[calendarDays.length - 1] ??
        endOfWeek(selectedDate, { weekStartsOn: 1 });
      return `${format(firstDay, "MMM d")} – ${format(lastDay, "MMM d, yyyy")}`;
    }
    return format(selectedDate, "MMMM, yyyy");
  }, [calendarDays, selectedDate, view]);

  function navigateDate(direction: -1 | 1) {
    setSelectedDate((current) => {
      if (view === "Day") return addDays(current, direction);
      if (view === "Week") return addWeeks(current, direction);
      return addMonths(current, direction);
    });
  }

  function toggleCategory(category: CalendarCategory) {
    setSelectedCategories((current) => {
      const next = current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category];

      // Selecting every category is equivalent to clearing the filter.
      return next.length === CATEGORIES.length ? [] : next;
    });
  }

  function showDay(day: Date) {
    setSelectedDate(day);
    setView("Day");
  }

  function renderEventCard(
    event: CalendarEventResponse,
    compact = false,
    dense = false,
  ) {
    const style =
      CATEGORY_STYLES[event.category as CalendarCategory] ??
      CATEGORY_STYLES.OTHER;
    const eventTime = event.delivery ? `Departure ${format(event.start_time, "h:mm a")}` : formatTimeRange(event.start_time, event.end_time);

    return (
      <button
        key={calendarEventKey(event)}
        type="button"
        title={`${event.title} · ${eventTime}`}
        aria-label={`${event.delivery ? "View" : "Edit"} ${event.title}, ${eventTime}`}
        onClick={() => {
          if (event.delivery) { setSelectedDeliveryId(event.delivery.id); return; }
          setSelected({ id: Number(event.id), version: event.version });
          openModal(DialogMode.EDIT, {
            title: "Edit Event",
            description: "Edit the details of your event",
            action: "Save",
          });
        }}
        className={`h-full w-full overflow-hidden rounded-md border border-l-[3px] text-left shadow-sm transition hover:shadow-md focus-visible:z-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${style.card} ${style.accent} ${event.delivery?.status === "cancelled" ? "border-dashed opacity-75" : ""} ${compact ? "px-2 py-1 text-xs" : dense ? "px-1.5 py-0.5 text-[11px]" : "p-2"}`}
      >
        <span
          className={`block truncate font-semibold ${dense ? "leading-4" : "leading-5"}`}
        >
          {event.title}
        </span>
        {compact && event.delivery && <span className="block truncate text-[11px]">{eventTime}</span>}
        {!compact && !dense && (
          <span className="mt-1 flex items-center gap-1 text-xs opacity-80">
            <Clock3 className="size-3 shrink-0" />
            <span className="truncate">{eventTime}</span>
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-6 text-foreground">
      <DeliveryCalendarDetails delivery={deliveryQuery.data?.find(delivery => delivery.id === selectedDeliveryId)} onClose={() => setSelectedDeliveryId(null)} />
      {deliveryQuery.isPending && <p role="status" className="text-sm text-muted-foreground">Loading deliveries...</p>}
      {deliveryQuery.isError && <div role="alert" className="flex items-center gap-3 text-sm"><span>Unable to load deliveries.</span><Button variant="outline" size="sm" onClick={() => void deliveryQuery.refetch()}>Retry deliveries</Button></div>}
      <p className="text-sm text-muted-foreground">All dates and times are in Asia/Manila (UTC+8).</p>
      {eventQuery.isError && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
        <span>{eventQuery.data ? "Unable to refresh. Showing the last loaded events." : "Unable to load calendar events."}</span>
        <Button variant="outline" size="sm" disabled={eventQuery.isFetching} onClick={() => void eventQuery.refetch()}>Retry</Button>
      </div>}
      {/* Calendar controls */}
      <div className="flex flex-col gap-4 border-b pb-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex items-center gap-1 pt-0.5">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8 rounded-full"
              aria-label="Previous date range"
              onClick={() => navigateDate(-1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8 rounded-full"
              aria-label="Next date range"
              onClick={() => navigateDate(1)}
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ml-1 h-8 rounded-full px-3"
              onClick={() => setSelectedDate(manilaCalendarNow())}
            >
              Today
            </Button>
          </div>

          <div className="min-w-0">
            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    className="-ml-2 h-auto max-w-full justify-start gap-1.5 px-2 py-1 text-left hover:bg-muted/60"
                    aria-label="Choose calendar date"
                  >
                    <span className="truncate text-lg font-semibold tracking-tight sm:text-2xl">
                      {heading}
                    </span>
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                  </Button>
                }
              />
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  month={selectedDate}
                  weekStartsOn={1}
                  onMonthChange={setSelectedDate}
                  onSelect={(date) => {
                    if (!date) return;
                    setSelectedDate(date);
                    setDatePickerOpen(false);
                  }}
                />
              </PopoverContent>
            </Popover>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-sky-700 dark:text-sky-300">
              <CalendarDays className="size-4" />
              {visibleEventCount} {visibleEventCount === 1 ? "event" : "events"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-full bg-muted p-1">
            {(["Day", "Week", "Month"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setView(mode)}
                aria-pressed={view === mode}
                className={`min-w-20 rounded-full px-4 py-2 text-sm transition ${
                  view === mode
                    ? "bg-background font-semibold text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
          <Button
            type="button"
            className="rounded-full"
            onClick={() =>
              openModal(DialogMode.INSERT, {
                title: "New Event",
                description: "Create a new event in your calendar",
                action: "Create",
              })
            }
          >
            <Plus className="mr-2 size-4" />
            New Event
          </Button>
        </div>
      </div>

      {/* Category filters */}
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Filter className="size-4 text-muted-foreground" />
          <span>Filter by category</span>
          <span className="text-xs font-normal text-muted-foreground">
            {selectedCategories.length === 0
              ? "Showing all"
              : `${selectedCategories.length} selected`}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={selectedCategories.length === 0 ? "default" : "outline"}
            className="rounded-full"
            aria-pressed={selectedCategories.length === 0}
            onClick={() => setSelectedCategories([])}
          >
            All categories
          </Button>
          {CATEGORIES.map((category) => {
            const isSelected = selectedCategories.includes(category);
            return (
              <Button
                key={category}
                type="button"
                size="sm"
                variant={isSelected ? "default" : "outline"}
                className="rounded-full"
                aria-pressed={isSelected}
                onClick={() => toggleCategory(category)}
              >
                <span
                  className={`mr-2 size-2 rounded-full ${CATEGORY_STYLES[category].dot}`}
                />
                {category.replaceAll("_", " ")}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
        {eventQuery.isPending ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Loading calendar events…
          </div>
        ) : (
          <>
            {view === "Month" ? (
              <div className="overflow-x-auto">
                <div className="min-w-[840px]">
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
                      const dayEvents = (filteredEvents ?? [])
                        .filter(
                          (event) =>
                            event.end_time > dayStart &&
                            event.start_time < dayEnd,
                        )
                        .sort(
                          (a, b) =>
                            a.start_time.getTime() - b.start_time.getTime(),
                        );

                      return (
                        <div
                          key={format(day, "yyyy-MM-dd")}
                          className={`min-h-32 border-b border-r p-2 last:border-r-0 ${
                            !isSameMonth(day, selectedDate)
                              ? "bg-muted/20 text-muted-foreground"
                              : ""
                          }`}
                        >
                          <div className="mb-2 flex justify-end">
                            <button
                              type="button"
                              onClick={() => showDay(day)}
                              aria-label={`Show events for ${format(day, "MMMM d, yyyy")}`}
                              className={`flex size-7 items-center justify-center rounded-full text-sm transition hover:bg-muted ${
                                isSameDay(day, now)
                                  ? "bg-slate-900 font-semibold text-white hover:bg-slate-700"
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
                                className="w-full rounded px-1 py-1 text-left text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
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
              <div className="overflow-x-auto">
                <div
                  className="min-w-[620px]"
                  style={{
                    minWidth:
                      view === "Week"
                        ? `${84 + calendarDays.length * 190}px`
                        : "620px",
                  }}
                >
                  {/* Day labels */}
                  <div
                    className="grid border-b bg-muted/20"
                    style={{
                      gridTemplateColumns: `84px repeat(${calendarDays.length}, minmax(${view === "Week" ? "190px" : "0"}, 1fr))`,
                    }}
                  >
                    <div className="flex items-center justify-center border-r px-2 py-4 text-xs font-medium text-muted-foreground">
                      PHT (UTC+8)
                    </div>
                    {calendarDays.map((day) => (
                      <button
                        key={format(day, "yyyy-MM-dd")}
                        type="button"
                        onClick={() => showDay(day)}
                        className="border-r px-2 py-3 text-center last:border-r-0 hover:bg-muted/40"
                      >
                        <span
                          className={`mx-auto flex size-8 items-center justify-center rounded-full text-lg font-semibold leading-6 ${
                            isSameDay(day, now) ? "bg-slate-900 text-white" : ""
                          }`}
                        >
                          {format(day, "d")}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {format(day, "EEEE")}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Time slots and side-by-side event cards */}
                  <div
                    className="grid"
                    style={{
                      gridTemplateColumns: `84px repeat(${calendarDays.length}, minmax(${view === "Week" ? "190px" : "0"}, 1fr))`,
                    }}
                  >
                    <div
                      className="relative border-r"
                      style={{ height: HOURS.length * HOUR_HEIGHT }}
                    >
                      {HOURS.map((hour, index) => (
                        <div
                          key={hour}
                          className="absolute right-0 z-10 -translate-y-1/2 bg-background px-3 text-xs font-medium text-muted-foreground"
                          style={{ top: index * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
                        >
                          {format(atTime(selectedDate, hour), "hh a")}
                        </div>
                      ))}
                    </div>

                    {calendarDays.map((day) => {
                      const dayStart = atTime(day, START_HOUR);
                      const dayEnd = atTime(day, END_HOUR);
                      const dayEvents = (filteredEvents ?? [])
                        .filter(
                          (event) =>
                            event.end_time > dayStart &&
                            event.start_time < dayEnd,
                        )
                        .sort(
                          (a, b) =>
                            a.start_time.getTime() - b.start_time.getTime(),
                        );
                      const positionedEvents =
                        layoutOverlappingEvents(dayEvents);
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
                              className="pointer-events-none absolute left-0 right-0 border-t border-border/80"
                              style={{ top: index * HOUR_HEIGHT }}
                            />
                          ))}
                          <div
                            className="pointer-events-none absolute left-0 right-0 border-t border-border/80"
                            style={{ top: HOURS.length * HOUR_HEIGHT }}
                          />

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
                              // Clip multi-day events to the visible hours of this day.
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
                                (visibleEnd.getTime() -
                                  visibleStart.getTime()) /
                                60_000;
                              const top = (startMinutes / 60) * HOUR_HEIGHT + 3;
                              const height = Math.max(
                                (durationMinutes / 60) * HOUR_HEIGHT - 6,
                                28,
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
                                  {renderEventCard(event, false, height < 56)}
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
          </>
        )}
      </div>
    </div>
  );
}
