"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  MapPin,
  Navigation,
  Sparkles,
  Truck,
  User,
} from "lucide-react";
import { DeliveryCalendarDetails } from "@/components/delivery-calendar-details";
import {
  deliveryStatusLabel,
  type DeliveryCalendarEntry,
} from "@/schema/delivery-calendar";
import { manilaCalendarNow, parseLocalDateTime } from "@/utils/date-util";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import DashboardFleetMap from "../dashboard-fleet-map";

function makeDateKey(year: number, monthIndex: number, day: number) {
  return [
    year,
    String(monthIndex + 1).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

function CalendarWidget({ events }: { events: DeliveryCalendarEntry[] }) {
  const today = manilaCalendarNow();
  const [month, setMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selectedDate, setSelectedDate] = useState(() =>
    makeDateKey(today.getFullYear(), today.getMonth(), today.getDate())
  );
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<number | null>(
    null
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

  const deliveryEventCounts = events.reduce<Record<string, number>>(
    (counts, event) => {
      counts[event.date] = (counts[event.date] ?? 0) + 1;
      return counts;
    },
    {}
  );

  const selectedDeliveries = events.filter(
    (event) => event.date === selectedDate
  );
  const selectedCount = selectedDeliveries.length;

  const selectedLabel = new Date(`${selectedDate}T00:00:00`).toLocaleDateString(
    "en-PH",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  );

  return (
    <Card className="flex h-full flex-col overflow-hidden rounded-2xl border bg-card shadow-xs">
      <DeliveryCalendarDetails
        delivery={events.find((d) => d.id === selectedDeliveryId)}
        onClose={() => setSelectedDeliveryId(null)}
      />

      <CardHeader className="border-b bg-muted/20 px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CalendarDays className="size-4" />
            </span>
            <div>
              <h3 className="text-sm font-semibold tracking-tight">
                Dispatch Calendar
              </h3>
              <p className="text-xs text-muted-foreground">
                Scheduled departures by date
              </p>
            </div>
          </div>

          <Link
            href="/panel/calendar"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Full view
            <ExternalLink className="size-3" />
          </Link>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col p-5 space-y-4">
        {/* Month selector navigation */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">
            {month.toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </span>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => {
                setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
                setSelectedDate(
                  makeDateKey(
                    today.getFullYear(),
                    today.getMonth(),
                    today.getDate()
                  )
                );
              }}
            >
              Today
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label="Previous month"
              onClick={() =>
                setMonth(
                  (c) => new Date(c.getFullYear(), c.getMonth() - 1, 1)
                )
              }
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label="Next month"
              onClick={() =>
                setMonth(
                  (c) => new Date(c.getFullYear(), c.getMonth() + 1, 1)
                )
              }
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
            <div
              key={day}
              className="pb-1 text-[11px] font-medium text-muted-foreground uppercase"
            >
              {day}
            </div>
          ))}

          {cells.map((day, index) => {
            if (day === null) {
              return <div key={`empty-${index}`} className="h-8" />;
            }

            const dateKey = makeDateKey(year, monthIndex, day);
            const count = deliveryEventCounts[dateKey] ?? 0;
            const isSelected = selectedDate === dateKey;
            const isToday =
              dateKey ===
              makeDateKey(
                today.getFullYear(),
                today.getMonth(),
                today.getDate()
              );

            return (
              <button
                key={dateKey}
                type="button"
                aria-label={`${dateKey}${count ? `, ${count} departures` : ""}`}
                aria-pressed={isSelected}
                aria-current={isToday ? "date" : undefined}
                onClick={() => setSelectedDate(dateKey)}
                className={`group relative mx-auto flex h-8 w-8 flex-col items-center justify-center rounded-lg text-xs font-medium transition-all ${
                  isSelected
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : isToday
                    ? "ring-1.5 ring-primary/60 font-bold hover:bg-muted"
                    : "hover:bg-muted text-foreground"
                }`}
              >
                <span>{day}</span>
                {count > 0 && (
                  <span
                    className={`absolute -bottom-0.5 size-1 rounded-full ${
                      isSelected
                        ? "bg-primary-foreground"
                        : "bg-blue-600 dark:bg-blue-400"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Selected date departures panel */}
        <div className="flex-1 rounded-xl border bg-muted/20 p-3">
          <div className="flex items-center justify-between pb-2 border-b border-border/40">
            <div>
              <p className="text-xs font-semibold">{selectedLabel}</p>
              <p className="text-[10px] text-muted-foreground">Manila time</p>
            </div>
            <Badge
              variant={selectedCount > 0 ? "secondary" : "outline"}
              className="text-[11px] h-5"
            >
              {selectedCount} {selectedCount === 1 ? "run" : "runs"}
            </Badge>
          </div>

          <div className="mt-2.5">
            {selectedDeliveries.length ? (
              <ul className="max-h-52 space-y-2 overflow-y-auto pr-1">
                {selectedDeliveries.map((delivery) => {
                  const start = parseLocalDateTime(
                    delivery.date,
                    delivery.start_time
                  );
                  return (
                    <li key={delivery.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedDeliveryId(delivery.id)}
                        className="w-full rounded-lg border bg-card p-2.5 text-left transition-all hover:border-primary/40 hover:bg-muted/30 focus-visible:outline-2 focus-visible:outline-primary"
                      >
                        <div className="flex items-start justify-between gap-1">
                          <span className="text-xs font-semibold text-foreground">
                            Run #{delivery.id} · {delivery.vehicle}
                          </span>
                          <span className="text-[10px] font-medium text-primary">
                            {deliveryStatusLabel[delivery.status] ??
                              delivery.status}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <Clock3 className="size-3" />
                          <span>
                            {start.toLocaleTimeString("en-PH", {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </span>
                          <span className="text-muted-foreground/40">·</span>
                          <User className="size-3" />
                          <span className="truncate">{delivery.driver}</span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="py-6 text-center">
                <p className="text-xs text-muted-foreground">
                  No scheduled departures for this date.
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function FleetCalendarHub({
  deliveryCalendar,
}: {
  deliveryCalendar: DeliveryCalendarEntry[];
}) {
  return (
    <section
      aria-labelledby="fleet-command-heading"
      className="space-y-4"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2
              id="fleet-command-heading"
              className="text-lg font-bold tracking-tight"
            >
              Fleet & Dispatch Command
            </h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Telemetry
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Real-time GPS vehicle locations, active road paths, and scheduled run departures
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            nativeButton={false}
            variant="outline"
            size="sm"
            className="h-8 text-xs font-medium"
            render={<Link href="/panel/fleet-map" />}
          >
            <Navigation className="mr-1.5 size-3.5" />
            Full Fleet Map
          </Button>
          <Button
            nativeButton={false}
            variant="outline"
            size="sm"
            className="h-8 text-xs font-medium"
            render={<Link href="/panel/delivery-schedules" />}
          >
            <CalendarDays className="mr-1.5 size-3.5" />
            All Schedules
          </Button>
        </div>
      </div>

      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* Map Container */}
        <div className="overflow-hidden rounded-2xl border bg-card shadow-xs">
          <div className="flex items-center justify-between border-b bg-muted/20 px-4 py-2.5">
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                <Truck className="size-3.5 text-primary" />
                Fleet GPS
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5 text-rose-500" />
                Active Stops
              </span>
              <span className="hidden sm:inline-flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-amber-500" />
                Road Routing
              </span>
            </div>

            <span className="text-[11px] text-muted-foreground">
              Updated automatically via WebSocket
            </span>
          </div>

          <DashboardFleetMap />
        </div>

        {/* Dispatch Calendar */}
        <div className="h-[520px] lg:h-full">
          <CalendarWidget events={deliveryCalendar} />
        </div>
      </div>
    </section>
  );
}
export default FleetCalendarHub;
