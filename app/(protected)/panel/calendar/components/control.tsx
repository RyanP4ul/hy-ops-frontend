import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";

export default function Control() {
  return (
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
  );
}
