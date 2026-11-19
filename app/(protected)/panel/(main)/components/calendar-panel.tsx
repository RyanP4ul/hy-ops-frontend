"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { DeliveryCalendarDetails } from "@/components/delivery-calendar-details";
import {
  deliveryStatusLabel,
  type DeliveryCalendarEntry,
} from "@/schema/delivery-calendar";
import { manilaCalendarNow, parseLocalDateTime } from "@/utils/date-util";
import { Button } from "@/components/ui/button";

function makeDateKey(year: number, monthIndex: number, day: number) {
  return [
    year,
    String(monthIndex + 1).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

export function CalendarPanel({
  events,
}: {
  events: DeliveryCalendarEntry[];
}) {
  const today = manilaCalendarNow();
  const [month, setMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [selectedDate, setSelectedDate] = useState(() =>
    makeDateKey(today.getFullYear(), today.getMonth(), today.getDate()),
  );
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<number | null>(
    null,
  );

  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  const cells = Array.from({ length: totalCells }, (_, index) => {
    const day = index - firstDay + 1;
    return day >= 1 && day <= daysInMonth ? day : null;
  });

  const eventCounts = useMemo(
    () =>
      events.reduce<Record<string, number>>((counts, event) => {
        counts[event.date] = (counts[event.date] ?? 0) + 1;
        return counts;
      }, {}),
    [events],
  );

  const selectedDeliveries = useMemo(
    () => events.filter((event) => event.date === selectedDate),
    [events, selectedDate],
  );

  const selectedLabel = new Date(`${selectedDate}T00:00:00`).toLocaleDateString(
    "en-PH",
    { month: "short", day: "numeric", year: "numeric" },
  );

  const todayKey = makeDateKey(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  return (
    <aside
      aria-label="Delivery calendar"
      className="flex h-[460px] min-w-0 flex-col border-t xl:h-[540px] xl:border-t-0 xl:border-l"
    >
      <DeliveryCalendarDetails
        delivery={events.find((d) => d.id === selectedDeliveryId)}
        onClose={() => setSelectedDeliveryId(null)}
      />

      {/* Month controls + grid */}
      <div className="shrink-0 border-b px-4 py-3.5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold tracking-tight">
            {month.toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </h2>

          <div className="flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => {
                setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
                setSelectedDate(todayKey);
              }}
            >
              Today
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Previous month"
              onClick={() =>
                setMonth((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))
              }
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Next month"
              onClick={() =>
                setMonth((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))
              }
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-y-0.5 text-center">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
            <div
              key={day}
              className="pb-1.5 text-[11px] font-medium text-muted-foreground"
            >
              {day}
            </div>
          ))}

          {cells.map((day, index) => {
            if (day === null) return <div key={`empty-${index}`} />;
            const dateKey = makeDateKey(year, monthIndex, day);
            const count = eventCounts[dateKey] ?? 0;
            const isSelected = selectedDate === dateKey;
            const isToday = dateKey === todayKey;

            return (
              <button
                key={dateKey}
                type="button"
                aria-label={`${dateKey}${count ? `, ${count} deliveries` : ""}`}
                aria-pressed={isSelected}
                aria-current={isToday ? "date" : undefined}
                onClick={() => setSelectedDate(dateKey)}
                className={[
                  "relative mx-auto flex h-8 w-8 items-center justify-center rounded-md text-xs tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                  isSelected
                    ? "bg-primary font-semibold text-primary-foreground"
                    : "hover:bg-muted",
                  isToday && !isSelected
                    ? "font-semibold ring-1 ring-border"
                    : "",
                ].join(" ")}
              >
                {day}
                {count > 0 && (
                  <span
                    aria-hidden="true"
                    className={[
                      "absolute bottom-1 size-1 rounded-full",
                      isSelected ? "bg-primary-foreground" : "bg-blue-500",
                    ].join(" ")}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected date runs */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between px-4 py-2.5 text-xs">
          <span className="font-medium text-foreground">{selectedLabel}</span>
          <span className="text-muted-foreground tabular-nums">
            {selectedDeliveries.length}{" "}
            {selectedDeliveries.length === 1 ? "run" : "runs"}
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {selectedDeliveries.length ? (
            <ul className="space-y-1">
              {selectedDeliveries.map((delivery) => {
                const start = parseLocalDateTime(
                  delivery.date,
                  delivery.start_time,
                );
                return (
                  <li key={delivery.id}>
                    <button
                      type="button"
                      aria-label={`View delivery #${delivery.id}`}
                      onClick={() => setSelectedDeliveryId(delivery.id)}
                      className="w-full rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-medium text-foreground">
                          #{delivery.id} · {delivery.vehicle}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                          {start.toLocaleTimeString("en-PH", {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {delivery.driver} ·{" "}
                        {deliveryStatusLabel[delivery.status]}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-2 py-8 text-center text-xs text-muted-foreground">
              No departures scheduled.
            </p>
          )}
        </div>

        <div className="shrink-0 border-t px-4 py-2.5">
          <Link
            href="/panel/calendar"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            <span>Full calendar</span>
            <ArrowRight aria-hidden="true" className="size-3.5" />
          </Link>
        </div>
      </div>
    </aside>
  );
}
