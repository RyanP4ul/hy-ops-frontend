"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  addWeeks,
  endOfWeek,
  format,
  startOfWeek,
} from "date-fns";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useModal } from "@/components/providers/modal-provider";
import { DialogMode } from "@/types/dialog";
import { manilaCalendarNow } from "@/utils/date-util";
import { useCalendar } from "../provider";

const VIEW_MODES: CalendarViewMode[] = ["Agenda", "Day", "Week", "Month"];

export default function Control() {
  const {
    view,
    setView,
    selectedDate,
    setSelectedDate,
    calendarDays,
    visibleDeliveries,
    visibleEvents,
  } = useCalendar();
  const { openModal } = useModal();
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const heading = useMemo(() => {
    if (view === "Day") return format(selectedDate, "EEE, MMM d, yyyy");
    if (view === "Month") return format(selectedDate, "MMMM, yyyy");
    const firstDay =
      calendarDays[0] ?? startOfWeek(selectedDate, { weekStartsOn: 1 });
    const lastDay =
      calendarDays[calendarDays.length - 1] ??
      endOfWeek(selectedDate, { weekStartsOn: 1 });
    return `${format(firstDay, "MMM d")} – ${format(lastDay, "MMM d, yyyy")}`;
  }, [calendarDays, selectedDate, view]);

  const manualEventCount = visibleEvents.length - visibleDeliveries.length;

  function navigateDate(direction: -1 | 1) {
    setSelectedDate((current) => {
      if (view === "Day") return addDays(current, direction);
      if (view === "Month") return addMonths(current, direction);
      return addWeeks(current, direction);
    });
  }

  return (
    <header className="flex flex-col gap-4 border-b pb-5 xl:flex-row xl:items-end xl:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex shrink-0 items-center gap-1 pt-0.5">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8 rounded-full"
            aria-label="Previous date range"
            onClick={() => navigateDate(-1)}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8 rounded-full"
            aria-label="Next date range"
            onClick={() => navigateDate(1)}
          >
            <ChevronRight className="size-4" aria-hidden="true" />
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
                  <ChevronDown
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
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

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm">
            <span className="inline-flex items-center gap-1.5 font-medium text-sky-700 dark:text-sky-300">
              <Truck className="size-4 shrink-0" aria-hidden="true" />
              {visibleDeliveries.length}{" "}
              {visibleDeliveries.length === 1 ? "delivery run" : "delivery runs"}
            </span>
            {manualEventCount > 0 && (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
                {manualEventCount}{" "}
                {manualEventCount === 1 ? "other event" : "other events"}
              </span>
            )}
            <span className="text-muted-foreground">
              All dates and times are in Asia/Manila (UTC+8).
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <div
          role="group"
          aria-label="Calendar view mode"
          className="inline-flex rounded-full bg-muted p-1"
        >
          {VIEW_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setView(mode)}
              aria-pressed={view === mode}
              className={`min-h-8 min-w-[4.25rem] rounded-full px-3.5 py-1.5 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
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
          variant="outline"
          className="rounded-full"
          onClick={() =>
            openModal(DialogMode.INSERT, {
              title: "New Event",
              description: "Create a new operational note or event in your calendar",
              action: "Create",
            })
          }
        >
          <Plus className="mr-1.5 size-4" aria-hidden="true" />
          New Event
        </Button>

        <Button
          className="rounded-full"
          nativeButton={false}
          render={<Link href="/panel/delivery-schedules" />}
        >
          <Truck className="mr-1.5 size-4" aria-hidden="true" />
          Schedule Delivery
        </Button>
      </div>
    </header>
  );
}
