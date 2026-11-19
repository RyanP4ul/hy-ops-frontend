import { expect, test } from "bun:test";
import {
  calendarEventKey,
  deliveryCalendarEvent,
  getCalendarEventVisualEndTime,
  getDeliveryEffectiveStatus,
  getDeliveryStopStats,
  isDeliveryOverdue,
} from "../lib/delivery-calendar";
import { layoutOverlappingEvents } from "../lib/calendar-layout";
import type { DeliveryCalendarEntry } from "../schema/delivery-calendar";

const run: DeliveryCalendarEntry = {
  id: 1,
  version: 2,
  date: "2026-11-02",
  start_time: "23:59:00",
  status: "scheduled",
  driver: "Driver",
  vehicle: "TEST-001",
  warehouse: "North",
  warehouseId: 1,
  orders: [],
  pickupCount: 1,
};

test("delivery calendar uses Manila wall-clock fields and never invents an arrival duration", () => {
  const event = deliveryCalendarEvent(run);
  expect([
    event.start_time.getFullYear(),
    event.start_time.getMonth(),
    event.start_time.getDate(),
    event.start_time.getHours(),
    event.start_time.getMinutes(),
  ]).toEqual([2026, 10, 2, 23, 59]);
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

test("overdue detection evaluates Manila departure timestamps only for scheduled runs", () => {
  const departureMs = Date.parse("2026-11-02T23:59:00+08:00");
  expect(isDeliveryOverdue(run, departureMs - 60_000)).toBe(false);
  expect(isDeliveryOverdue(run, departureMs + 60_000)).toBe(true);
  expect(getDeliveryEffectiveStatus(run, departureMs + 60_000)).toBe("overdue");
  expect(
    getDeliveryEffectiveStatus(
      { ...run, status: "in_transit" },
      departureMs + 60_000,
    ),
  ).toBe("in_transit");
  expect(
    getDeliveryEffectiveStatus(
      { ...run, status: "completed" },
      departureMs + 60_000,
    ),
  ).toBe("completed");
});

test("stop stats summarize delivered, pending, failed stops and return pickups", () => {
  const stats = getDeliveryStopStats({
    pickupCount: 2,
    orders: [
      { id: 1, orderNumber: "ORD-1", recipient: "A", address: "Addr 1", status: "delivered" },
      { id: 2, orderNumber: "ORD-2", recipient: "B", address: "Addr 2", status: "pending" },
      { id: 3, orderNumber: "ORD-3", recipient: "C", address: "Addr 3", status: "failed" },
      { id: 4, orderNumber: "ORD-4", recipient: "D", address: "Addr 4", status: "delivered" },
    ],
  });
  expect(stats).toEqual({
    total: 4,
    delivered: 2,
    failed: 1,
    pending: 1,
    pickups: 2,
  });
});

test("nearby delivery departures layout side-by-side without mutating arrival end_time", () => {
  const first = deliveryCalendarEvent({ ...run, id: 10, start_time: "08:00:00" });
  const second = deliveryCalendarEvent({ ...run, id: 11, start_time: "08:15:00" });
  const positioned = layoutOverlappingEvents([first, second], (event) =>
    getCalendarEventVisualEndTime(event, 55),
  );
  expect(positioned).toHaveLength(2);
  expect(positioned[0].columnCount).toBe(2);
  expect(positioned[1].columnCount).toBe(2);
  expect(positioned[0].column).not.toBe(positioned[1].column);
  // Underlying 1ms departure duration stays untouched.
  expect(first.end_time.getTime() - first.start_time.getTime()).toBe(1);
});
