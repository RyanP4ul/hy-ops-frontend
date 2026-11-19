import type { DeliveryCalendarEntry } from "@/schema/delivery-calendar";
import { deliveryStatusLabel } from "@/schema/delivery-calendar";
import type { CalendarEventResponse } from "@/schema/calendar";
import { parseLocalDateTime } from "@/utils/date-util";

export const DAILY_STOP_CAPACITY = 5;

export type DeliveryEffectiveStatus =
  | DeliveryCalendarEntry["status"]
  | "overdue";

export type DeliveryStopStats = {
  total: number;
  delivered: number;
  failed: number;
  pending: number;
  pickups: number;
};

export const deliveryEffectiveStatusLabel: Record<
  DeliveryEffectiveStatus,
  string
> = {
  ...deliveryStatusLabel,
  overdue: "Overdue",
};

function normalizeManilaTime(time: string): string {
  return time.length === 5 ? `${time}:00` : time;
}

/**
 * Matches backend overdue logic: a scheduled run whose Manila departure time
 * has already passed without being dispatched.
 */
export function isDeliveryOverdue(
  delivery: Pick<DeliveryCalendarEntry, "date" | "start_time" | "status">,
  nowMs = Date.now(),
): boolean {
  if (delivery.status !== "scheduled") return false;
  const departureMs = Date.parse(
    `${delivery.date}T${normalizeManilaTime(delivery.start_time)}+08:00`,
  );
  return Number.isFinite(departureMs) && departureMs <= nowMs;
}

export function getDeliveryEffectiveStatus(
  delivery: Pick<DeliveryCalendarEntry, "date" | "start_time" | "status">,
  nowMs = Date.now(),
): DeliveryEffectiveStatus {
  return isDeliveryOverdue(delivery, nowMs) ? "overdue" : delivery.status;
}

export function getDeliveryStopStats(
  delivery: Pick<DeliveryCalendarEntry, "orders" | "pickupCount">,
): DeliveryStopStats {
  let delivered = 0;
  let failed = 0;
  let pending = 0;

  for (const order of delivery.orders) {
    if (order.status === "delivered") delivered += 1;
    else if (order.status === "failed") failed += 1;
    else pending += 1;
  }

  return {
    total: delivery.orders.length,
    delivered,
    failed,
    pending,
    pickups: delivery.pickupCount,
  };
}

/**
 * Visual-only end time used by the time-grid overlap algorithm so two
 * point-in-time delivery departures separated by 10-30 minutes are laid out
 * side-by-side instead of visually covering each other. Never mutates or
 * invents an arrival time on the underlying event.
 */
export function getCalendarEventVisualEndTime(
  event: CalendarEventResponse,
  minDeliveryMinutes = 50,
): Date {
  if (!event.delivery) return event.end_time;
  const dayEnd = new Date(event.start_time);
  dayEnd.setHours(24, 0, 0, 0);
  const visualEndMs = Math.min(
    event.start_time.getTime() + minDeliveryMinutes * 60_000,
    dayEnd.getTime(),
  );
  return new Date(Math.max(visualEndMs, event.end_time.getTime()));
}

export function deliveryCalendarEvent(delivery: DeliveryCalendarEntry): CalendarEventResponse {
  const start = parseLocalDateTime(delivery.date, delivery.start_time);
  return { id: delivery.id, version: delivery.version, title: `Delivery #${delivery.id} / ${delivery.vehicle} / ${deliveryStatusLabel[delivery.status]}`,
    category: "DELIVERY", date: parseLocalDateTime(delivery.date, "00:00"), start_time: start,
    // A departure is a point in time. A 1ms layout interval never invents an arrival time.
    end_time: new Date(start.getTime() + 1), delivery };
}

export const calendarEventKey = (event: CalendarEventResponse) => `${event.delivery ? "delivery" : "event"}-${event.id}`;
