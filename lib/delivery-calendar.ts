import type { DeliveryCalendarEntry } from "@/schema/delivery-calendar";
import { deliveryStatusLabel } from "@/schema/delivery-calendar";
import type { CalendarEventResponse } from "@/schema/calendar";
import { parseLocalDateTime } from "@/utils/date-util";

export function deliveryCalendarEvent(delivery: DeliveryCalendarEntry): CalendarEventResponse {
  const start = parseLocalDateTime(delivery.date, delivery.start_time);
  return { id: delivery.id, version: delivery.version, title: `Delivery #${delivery.id} / ${delivery.vehicle} / ${deliveryStatusLabel[delivery.status]}`,
    category: "DELIVERY", date: parseLocalDateTime(delivery.date, "00:00"), start_time: start,
    // A departure is a point in time. A 1ms layout interval never invents an arrival time.
    end_time: new Date(start.getTime() + 1), delivery };
}

export const calendarEventKey = (event: CalendarEventResponse) => `${event.delivery ? "delivery" : "event"}-${event.id}`;
