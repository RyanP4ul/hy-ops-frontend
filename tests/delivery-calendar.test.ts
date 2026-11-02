import { expect, test } from "bun:test";
import { calendarEventKey, deliveryCalendarEvent } from "../lib/delivery-calendar";
import type { DeliveryCalendarEntry } from "../schema/delivery-calendar";

const run: DeliveryCalendarEntry = { id: 1, version: 2, date: "2026-11-02", start_time: "23:59:00", status: "scheduled", driver: "Driver", vehicle: "TEST-001", warehouse: "North", warehouseId: 1, orders: [], pickupCount: 1 };
test("delivery calendar uses Manila wall-clock fields and never invents an arrival duration", () => {
  const event = deliveryCalendarEvent(run);
  expect([event.start_time.getFullYear(), event.start_time.getMonth(), event.start_time.getDate(), event.start_time.getHours(), event.start_time.getMinutes()]).toEqual([2026, 10, 2, 23, 59]);
  expect(event.end_time.getTime() - event.start_time.getTime()).toBe(1);
  expect(event.end_time.getDate()).toBe(2);
  expect(event.delivery).toBe(run);
  expect(event.category).toBe("DELIVERY");
});
test("delivery projections have distinct keys from editable manual events and preserve cancellation", () => {
  const event = deliveryCalendarEvent({ ...run, status: "cancelled" });
  expect(event.title).toContain("Cancelled");
  expect(calendarEventKey(event)).toBe("delivery-1");
  expect(calendarEventKey({ ...event, delivery: undefined })).toBe("event-1");
});
