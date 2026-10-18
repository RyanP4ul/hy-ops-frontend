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
  CalendarSync,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type CalendarViewMode = "Day" | "Week" | "Month";
type CalendarCategory = "Work" | "Personal" | "Breaks" | "Events";

type CalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  category: CalendarCategory;
  attendees: string[];
  extraAttendees: number;
};

type EventDraft = {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  category: CalendarCategory;
};

const START_HOUR = 8;
const END_HOUR = 18;
const HOUR_HEIGHT = 116;
const HOURS = Array.from(
  { length: END_HOUR - START_HOUR },
  (_, index) => START_HOUR + index,
);

const CATEGORIES: CalendarCategory[] = ["Work", "Personal", "Breaks", "Events"];

const CATEGORY_STYLES: Record<
  CalendarCategory,
  { card: string; accent: string; dot: string; month: string }
> = {
  Work: {
    card: "border-rose-100 bg-rose-50 text-slate-700",
    accent: "border-l-rose-500",
    dot: "bg-rose-500",
    month: "border-rose-200 bg-rose-50 text-rose-800",
  },
  Personal: {
    card: "border-emerald-100 bg-emerald-50 text-slate-700",
    accent: "border-l-emerald-500",
    dot: "bg-emerald-500",
    month: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  Breaks: {
    card: "border-amber-100 bg-amber-50 text-slate-700",
    accent: "border-l-amber-400",
    dot: "bg-amber-400",
    month: "border-amber-200 bg-amber-50 text-amber-800",
  },
  Events: {
    card: "border-sky-100 bg-sky-50 text-slate-700",
    accent: "border-l-sky-500",
    dot: "bg-sky-500",
    month: "border-sky-200 bg-sky-50 text-sky-800",
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

function makeInitialEvents(): CalendarEvent[] {
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
  const makeEvent = (
    id: string,
    dayOffset: number,
    title: string,
    startHour: number,
    endHour: number,
    category: CalendarCategory,
    extraAttendees = 0,
    attendees = ["MC", "JL", "AR"],
  ): CalendarEvent => {
    const day = addDays(monday, dayOffset);
    return {
      id,
      title,
      start: atTime(day, startHour),
      end: atTime(day, endHour),
      category,
      attendees,
      extraAttendees,
    };
  };

  return [
    makeEvent("evt-1", 0, "Daily standup", 9, 10, "Work", 4),
    makeEvent("evt-2", 0, "Agencies Birthday", 11, 13, "Events", 23),
    makeEvent("evt-3", 1, "Weekly Review", 10, 12, "Work", 4),
    makeEvent("evt-4", 1, "Meeting with Client", 12, 13, "Work", 4),
    makeEvent("evt-5", 2, "Check Up to Doctor", 9, 10, "Personal", 0, ["MC"]),
    makeEvent("evt-6", 2, "Bazaar", 10, 12, "Events", 2),
    makeEvent("evt-7", 2, "Lunch Break", 12, 13, "Breaks", 24),
    makeEvent("evt-8", 2, "Meeting with Client", 13, 14, "Work", 0, ["MC"]),
    makeEvent("evt-9", 3, "Daily standup", 9, 10, "Work", 10),
    makeEvent("evt-10", 3, "Meeting with Client", 11, 13, "Work", 9),
    makeEvent("evt-11", 4, "Product planning", 10, 11, "Events", 5),
  ];
}

function toDateInputValue(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function createEmptyDraft(date: Date): EventDraft {
  return {
    title: "",
    date: toDateInputValue(date),
    startTime: "09:00",
    endTime: "10:00",
    category: "Work",
  };
}

function formatTimeRange(start: Date, end: Date) {
  return `${format(start, "hh:mm a")} - ${format(end, "hh:mm a")}`;
}

export default function CalendarView() {
  const [selectedDate, setSelectedDate] = React.useState<Date>(
    () => new Date(),
  );
  const [view, setView] = React.useState<CalendarViewMode>("Week");
  const [events, setEvents] =
    React.useState<CalendarEvent[]>(makeInitialEvents);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingEventId, setEditingEventId] = React.useState<string | null>(
    null,
  );
  const [draft, setDraft] = React.useState<EventDraft>(() =>
    createEmptyDraft(new Date()),
  );
  const [formError, setFormError] = React.useState("");
  const [syncInfoOpen, setSyncInfoOpen] = React.useState(false);
  const [datePickerOpen, setDatePickerOpen] = React.useState(false);
  const [draftDatePickerOpen, setDraftDatePickerOpen] = React.useState(false);
  // An empty array means that all categories are visible.
  const [selectedCategories, setSelectedCategories] = React.useState<
    CalendarCategory[]
  >([]);

  const weekStart = React.useMemo(
    () => startOfWeek(selectedDate, { weekStartsOn: 1 }),
    [selectedDate],
  );

  const calendarDays = React.useMemo(() => {
    if (view === "Day") return [selectedDate];
    return eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });
  }, [selectedDate, view, weekStart]);

  const monthDays = React.useMemo(() => {
    const monthStart = startOfMonth(selectedDate);
    const monthEnd = endOfMonth(selectedDate);
    return eachDayOfInterval({
      start: startOfWeek(monthStart, { weekStartsOn: 1 }),
      end: endOfWeek(monthEnd, { weekStartsOn: 1 }),
    });
  }, [selectedDate]);

  const filteredEvents = React.useMemo(
    () =>
      events.filter(
        (event) =>
          selectedCategories.length === 0 ||
          selectedCategories.includes(event.category),
      ),
    [events, selectedCategories],
  );

  const visibleEventCount = React.useMemo(() => {
    return filteredEvents.filter((event) => {
      if (view === "Day") return isSameDay(event.start, selectedDate);
      if (view === "Week")
        return calendarDays.some((day) => isSameDay(event.start, day));
      return isSameMonth(event.start, selectedDate);
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

  function openCreateDialog() {
    setDraftDatePickerOpen(false);
    setEditingEventId(null);
    setDraft(createEmptyDraft(selectedDate));
    setFormError("");
    setDialogOpen(true);
  }

  function openEditDialog(event: CalendarEvent) {
    setDraftDatePickerOpen(false);
    setEditingEventId(event.id);
    setDraft({
      title: event.title,
      date: toDateInputValue(event.start),
      startTime: format(event.start, "HH:mm"),
      endTime: format(event.end, "HH:mm"),
      category: event.category,
    });
    setFormError("");
    setDialogOpen(true);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    const start = new Date(`${draft.date}T${draft.startTime}:00`);
    const end = new Date(`${draft.date}T${draft.endTime}:00`);

    if (!draft.title.trim()) {
      setFormError("Please enter an event title.");
      return;
    }

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setFormError("Please enter a valid date and time.");
      return;
    }

    if (end <= start) {
      setFormError("The end time must be later than the start time.");
      return;
    }

    if (editingEventId) {
      setEvents((current) =>
        current.map((item) =>
          item.id === editingEventId
            ? {
                ...item,
                title: draft.title.trim(),
                start,
                end,
                category: draft.category,
              }
            : item,
        ),
      );
    } else {
      setEvents((current) => [
        ...current,
        {
          id:
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `event-${Date.now()}`,
          title: draft.title.trim(),
          start,
          end,
          category: draft.category,
          attendees: [],
          extraAttendees: 0,
        },
      ]);
    }

    setSelectedDate(start);
    setView("Week");
    setDialogOpen(false);
  }

  function renderEventCard(event: CalendarEvent, compact = false) {
    const style = CATEGORY_STYLES[event.category];

    return (
      <button
        key={event.id}
        type="button"
        onClick={() => openEditDialog(event)}
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
                {formatTimeRange(event.start, event.end)}
              </span>
            </span>
            {(event.attendees.length > 0 || event.extraAttendees > 0) && (
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
            )}
          </>
        )}
      </button>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-6 text-foreground">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Calendar</span>
        <ChevronRight className="size-3.5" />
        <span className="font-medium text-foreground">All Calendar</span>
      </div>

      {/* Page heading */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your meetings, events, and schedule.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-fit rounded-full bg-background"
          onClick={() => setSyncInfoOpen(true)}
        >
          <CalendarSync className="mr-2 size-4 text-sky-600" />
          Sync to Google Calendar
        </Button>
      </div>

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
                  defaultMonth={selectedDate}
                  weekStartsOn={1}
                  initialFocus
                  onSelect={(date) => {
                    if (!date) return;
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
            onClick={openCreateDialog}
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

      {/* Calendar grid */}
      <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
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
                  const dayEvents = filteredEvents
                    .filter((event) => isSameDay(event.start, day))
                    .sort((a, b) => a.start.getTime() - b.start.getTime());

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
                  const dayStart = atTime(day, START_HOUR);
                  const dayEnd = atTime(day, END_HOUR);
                  const dayEvents = filteredEvents
                    .filter(
                      (event) =>
                        isSameDay(event.start, day) &&
                        event.end > dayStart &&
                        event.start < dayEnd,
                    )
                    .sort((a, b) => a.start.getTime() - b.start.getTime());

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
                          (event.start.getHours() - START_HOUR) * 60 +
                          event.start.getMinutes();
                        const durationMinutes =
                          (event.end.getTime() - event.start.getTime()) /
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
      </div>

      {/* Create / edit event dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              {editingEventId ? "Edit event" : "Create a new event"}
            </DialogTitle>
            <DialogDescription>
              Add the event details below. Click an event on the calendar to
              edit it.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="event-title">Event title</Label>
              <Input
                id="event-title"
                autoFocus
                placeholder="e.g. Weekly team meeting"
                value={draft.title}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                required
                maxLength={120}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="event-category">Category</Label>
              <Select
                value={draft.category}
                onValueChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    category: value as CalendarCategory,
                  }))
                }
              >
                <SelectTrigger id="event-category">
                  <SelectValue placeholder="Choose a category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      <span className="flex items-center gap-2">
                        <span
                          className={`size-2 rounded-full ${CATEGORY_STYLES[category].dot}`}
                        />
                        {category}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="event-date">Date</Label>
              <Popover
                open={draftDatePickerOpen}
                onOpenChange={setDraftDatePickerOpen}
              >
                <PopoverTrigger
                  render={
                    <Button
                      id="event-date"
                      type="button"
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                      aria-label="Choose event date"
                    >
                      <CalendarDays className="mr-2 size-4 text-muted-foreground" />
                      {draft.date
                        ? format(new Date(`${draft.date}T12:00:00`), "PPP")
                        : "Pick a date"}
                    </Button>
                  }
                />
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={
                      draft.date
                        ? new Date(`${draft.date}T12:00:00`)
                        : undefined
                    }
                    defaultMonth={
                      draft.date
                        ? new Date(`${draft.date}T12:00:00`)
                        : selectedDate
                    }
                    weekStartsOn={1}
                    initialFocus
                    onSelect={(date) => {
                      if (!date) return;
                      setDraft((current) => ({
                        ...current,
                        date: toDateInputValue(date),
                      }));
                      setDraftDatePickerOpen(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="event-start">Start time</Label>
                <Input
                  id="event-start"
                  type="time"
                  value={draft.startTime}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      startTime: event.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-end">End time</Label>
                <Input
                  id="event-end"
                  type="time"
                  value={draft.endTime}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      endTime: event.target.value,
                    }))
                  }
                  required
                />
              </div>
            </div>

            {formError && (
              <p className="text-sm text-destructive">{formError}</p>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                {editingEventId ? "Save changes" : "Create event"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Google Calendar integration placeholder */}
      <Dialog open={syncInfoOpen} onOpenChange={setSyncInfoOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Google Calendar sync</DialogTitle>
            <DialogDescription>
              This button is a UI placeholder. To enable syncing, connect your
              app to Google Calendar with Google OAuth and the Google Calendar
              API.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" onClick={() => setSyncInfoOpen(false)}>
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
