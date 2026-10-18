"use client";

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
import { formatTimeRange, toDateInputValue } from "@/utils/date-util";
import { useModal } from "@/components/providers/modal-provider";
import { DialogMode } from "@/types/dialog";
import { useCalendar } from "../provider";
import { CalendarEventResponse, CalendarFormType } from "@/schema/calendar";
import { request, requestWithErrorHandling } from "@/components/http";

const START_HOUR = 8;
const END_HOUR = 18;
const HOUR_HEIGHT = 116;
const HOURS = Array.from(
  { length: END_HOUR - START_HOUR },
  (_, index) => START_HOUR + index,
);

const CATEGORIES: CalendarCategory[] = [
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
  DELIVERY: {
    card: "bg-amber-200 text-amber-900",
    accent: "border-amber-500",
    dot: "bg-amber-500",
    month: "bg-amber-500/10 text-amber-900",
  },
  INVENTORY_WAREHOUSE: {
    card: "bg-lime-200 text-lime-900",
    accent: "border-lime-500",
    dot: "bg-lime-500",
    month: "bg-lime-500/10 text-lime-900",
  },
  VEHICLE_MAINTENANCE: {
    card: "bg-violet-200 text-violet-900",
    accent: "border-violet-500",
    dot: "bg-violet-500",
    month: "bg-violet-500/10 text-violet-900",
  },
  MEETING_APPOINTMENT: {
    card: "bg-sky-200 text-sky-900",
    accent: "border-sky-500",
    dot: "bg-sky-500",
    month: "bg-sky-500/10 text-sky-900",
  },
  OTHER: {
    card: "bg-slate-200 text-slate-900",
    accent: "border-slate-500",
    dot: "bg-slate-500",
    month: "bg-slate-500/10 text-slate-900",
  },
};

const AVATAR_COLORS = [
  "bg-amber-200 text-amber-900",
  "bg-lime-200 text-lime-900",
  "bg-violet-200 text-violet-900",
];

function atTime(day: Date, hour: number, minute = 0) {
  const date = new Date(day);
  date.setHours(hour, minute, 0, 0);
  return date;
}

export default function Page() {
  const {
    eventQuery,
    calendar_form,
    filteredEvents,
    view,
    setView,
    selectedDate,
    setSelectedDate,
    calendarDays,
    selectedCategories,
    setSelectedCategories,
    selected,
    setSelected,
  } = useCalendar();
  const { state, dispatch, openModal } = useModal();

  const [datePickerOpen, setDatePickerOpen] = React.useState(false);

  const monthDays = React.useMemo(() => {
    const monthStart = startOfMonth(selectedDate);
    const monthEnd = endOfMonth(selectedDate);
    return eachDayOfInterval({
      start: startOfWeek(monthStart, { weekStartsOn: 1 }),
      end: endOfWeek(monthEnd, { weekStartsOn: 1 }),
    });
  }, [selectedDate]);

  const visibleEventCount = React.useMemo(() => {
    return filteredEvents?.filter((event) => {
      if (view === "Day") return isSameDay(event.start_time, selectedDate);
      if (view === "Week")
        return calendarDays.some((day) => isSameDay(event.start_time, day));
      return isSameMonth(event.start_time, selectedDate);
    }).length;
  }, [calendarDays, filteredEvents, selectedDate, view]);

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

  async function handleSubmit(data: CalendarFormType) {
    // event.preventDefault();
    // setFormError("");
    // const start = new Date(`${draft.date}T${draft.startTime}:00`);
    // const end = new Date(`${draft.date}T${draft.endTime}:00`);
    // if (!draft.title.trim()) {
    //   setFormError("Please enter an event title.");
    //   return;
    // }
    // if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    //   setFormError("Please enter a valid date and time.");
    //   return;
    // }
    // if (end <= start) {
    //   setFormError("The end time must be later than the start time.");
    //   return;
    // }
    // if (editingEventId) {
    //   setEvents((current) =>
    //     current.map((item) =>
    //       item.id === editingEventId
    //         ? {
    //             ...item,
    //             title: draft.title.trim(),
    //             start,
    //             end,
    //             category: draft.category,
    //           }
    //         : item,
    //     ),
    //   );
    // } else {
    //   setEvents((current) => [
    //     ...current,
    //     {
    //       id:
    //         typeof crypto !== "undefined" && "randomUUID" in crypto
    //           ? crypto.randomUUID()
    //           : `event-${Date.now()}`,
    //       title: draft.title.trim(),
    //       start,
    //       end,
    //       category: draft.category,
    //       attendees: [],
    //       extraAttendees: 0,
    //     },
    //   ]);
    // }
    // setSelectedDate(start);
    // setView("Week");
    // dispatch({ type: "CLOSE" });
  }

  function parseLocalDateTime(date: string, time: string) {
    return new Date(`${date}T${time}`);
  }

  function renderEventCard(event: CalendarEventResponse, compact = false) {
    const style = CATEGORY_STYLES[event.category as CalendarCategory];

    return (
      <button
        key={event.id}
        type="button"
        onClick={() => {
          setSelected({ id: Number(event.id), version: 1 });
          openModal(DialogMode.EDIT, {
            title: "Edit Event",
            description: "Edit the details of your event",
            action: "Save",
          });
        }}
        className={`w-full rounded-lg border border-l-[3px] text-left shadow-sm transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${style.card} ${style.accent} ${compact ? "px-2 py-1 text-xs" : "p-2.5"}`}
      >
        <span className="block truncate font-semibold leading-5">
          {event.title}
        </span>
        {!compact && (
          <>
            <span className="mt-1 flex items-center gap-1 text-xs text-slate-600">
              <Clock3 className="size-3 shrink-0" />
              <span className="truncate">
                {formatTimeRange(event.start_time, event.end_time)}
              </span>
            </span>
            {/* {(event.attendees.length > 0 || event.extraAttendees > 0) && (
              <span className="mt-3 flex items-center gap-1.5 overflow-hidden">
                <span className="flex -space-x-1.5">
                  {event.attendees.slice(0, 3).map((attendee, index) => (
                    <span
                      key={`${event.id}-${attendee}-${index}`}
                      className={`flex size-5 shrink-0 items-center justify-center rounded-full border border-white text-[8px] font-bold ${AVATAR_COLORS[index % AVATAR_COLORS.length]}`}
                    >
                      {attendee}
                    </span>
                  ))}
                </span>
                {event.extraAttendees > 0 && (
                  <span className="truncate text-[11px] text-slate-600">
                    +{event.extraAttendees} Other
                  </span>
                )}
              </span>
            )} */}
          </>
        )}
      </button>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-6 text-foreground">
      {/* Calendar controls */}
      <div className="flex flex-col gap-4 border-b pb-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex gap-1 pt-0.5">
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
          </div>
          <div>
            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    className="-ml-2 h-auto justify-start gap-1.5 px-2 py-1 text-left hover:bg-muted/60"
                    aria-label="Choose calendar date"
                  >
                    <span className="text-xl font-semibold tracking-tight sm:text-2xl">
                      {format(selectedDate, "MMMM, yyyy")}
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
                    if (!date) {
                      console.error("No date selected");
                      return;
                    }

                    setSelectedDate(date);
                    setDatePickerOpen(false);
                  }}
                />
              </PopoverContent>
            </Popover>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-sky-600">
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
                {category}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
        {eventQuery.isFetching ? (
          <>Loading...</>
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
                      if (!filteredEvents) return null;
                      const dayEvents = filteredEvents
                        .filter((event) => isSameDay(event.start_time, day))
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
                            <span
                              className={`flex size-7 items-center justify-center rounded-full text-sm ${
                                isSameDay(day, new Date())
                                  ? "bg-slate-900 font-semibold text-white"
                                  : ""
                              }`}
                            >
                              {format(day, "d")}
                            </span>
                          </div>
                          <div className="space-y-1">
                            {dayEvents
                              .slice(0, 3)
                              .map((event) => renderEventCard(event, true))}
                            {dayEvents.length > 3 && (
                              <p className="px-1 text-xs text-muted-foreground">
                                +{dayEvents.length - 3} more
                              </p>
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
                  style={{ minWidth: view === "Week" ? "1120px" : "620px" }}
                >
                  {/* Day labels */}
                  <div
                    className="grid border-b bg-muted/20"
                    style={{
                      gridTemplateColumns: `84px repeat(${calendarDays.length}, minmax(0, 1fr))`,
                    }}
                  >
                    <div className="flex items-center justify-center border-r px-2 py-4 text-xs font-medium text-muted-foreground">
                      UTC +8
                    </div>
                    {calendarDays.map((day) => (
                      <button
                        key={format(day, "yyyy-MM-dd")}
                        type="button"
                        onClick={() => {
                          setSelectedDate(day);
                          setView("Day");
                        }}
                        className="border-r px-2 py-3 text-center last:border-r-0 hover:bg-muted/40"
                      >
                        <span className="block text-lg font-semibold leading-6">
                          {format(day, "d")}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {format(day, "EEEE")}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Time slots and event cards */}
                  <div
                    className="grid"
                    style={{
                      gridTemplateColumns: `84px repeat(${calendarDays.length}, minmax(0, 1fr))`,
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
                      if (!filteredEvents) return null;

                      const dayStart = atTime(day, START_HOUR);
                      const dayEnd = atTime(day, END_HOUR);
                      const dayEvents = filteredEvents
                        .filter(
                          (event) =>
                            isSameDay(event.start_time, day) &&
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
                          {dayEvents.map((event) => {
                            const startMinutes =
                              (event.start_time.getHours() - START_HOUR) * 60 +
                              event.start_time.getMinutes();
                            const durationMinutes =
                              (event.end_time.getTime() -
                                event.start_time.getTime()) /
                              60_000;
                            const top = (startMinutes / 60) * HOUR_HEIGHT + 4;
                            const height = Math.max(
                              (durationMinutes / 60) * HOUR_HEIGHT - 8,
                              48,
                            );

                            return (
                              <div
                                key={event.id}
                                className="absolute left-1 right-1 z-10"
                                style={{ top, height }}
                              >
                                {renderEventCard(event)}
                              </div>
                            );
                          })}
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
