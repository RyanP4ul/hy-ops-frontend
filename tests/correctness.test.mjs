import { expect, test } from "bun:test";
import { formatCurrency, sumKnownMoney, peso, parseLocalDateTime, manilaCalendarNow, isFutureManilaDeparture } from "../utils/date-util.ts";
import { formatElapsedTime } from "../utils/time.ts";
import { affectedQueryRoots, createEventDeduplicator } from "../lib/realtime.ts";

test("departure validation compares Manila time independently of the browser timezone", () => {
  const now = Date.parse("2026-10-31T16:00:00Z");
  expect(isFutureManilaDeparture("2026-11-01", "00:01", now)).toBe(true);
  expect(isFutureManilaDeparture("2026-11-01", "00:00", now)).toBe(false);
  expect(isFutureManilaDeparture("2026-10-31", "23:59", now)).toBe(false);
  expect(isFutureManilaDeparture("invalid", "09:00", now)).toBe(false);
});

test("money distinguishes missing, invalid, and zero amounts", () => {
  for (const input of [null, undefined, "", "   "]) expect(formatCurrency(input)).toBe("Not recorded");
  for (const input of [NaN, Infinity, -Infinity, "invalid"]) expect(formatCurrency(input)).toBe("Invalid amount");
  expect(formatCurrency(0)).toBe("₱0.00");
  expect(peso("1234.50")).toBe("₱1,234.50");
});

test("notification age follows Unix seconds and supports future timestamps", () => {
  const now = Date.parse("2026-10-30T00:00:00Z");
  expect(formatElapsedTime(now / 1000 - 120, now)).toBe("2 minutes ago");
  expect(formatElapsedTime(now / 1000 + 120, now)).toBe("in 2 minutes");
  for (const input of [null, undefined, NaN, Infinity]) expect(formatElapsedTime(input, now)).toBe("Date unavailable");
});

test("deduplication preserves handshakes, new versions, and unversioned updates", () => {
  const duplicate = createEventDeduplicator();
  const message = { type: "USER_UPDATED", payload: { id: 1, version: 1 } };
  expect(duplicate(message, 0)).toBe(false);
  expect(duplicate(message, 1)).toBe(true);
  expect(duplicate({ ...message, payload: { id: 1, version: 2 } }, 2)).toBe(false);
  expect(duplicate({ type: "WS_READY" }, 3)).toBe(false);
  expect(duplicate({ type: "WS_READY" }, 4)).toBe(false);
  for (let i = 0; i < 2; i++) expect(duplicate({ type: "USER_UPDATED", payload: { id: 1 } })).toBe(false);
  expect(duplicate(message, 30_001)).toBe(false);
  expect(createEventDeduplicator()(message, 2)).toBe(false);
});

test("deduplication cache is bounded", () => {
  const duplicate = createEventDeduplicator(2);
  const event = (id) => ({ type: "RESOURCE_CHANGED", payload: { eventId: id } });
  duplicate(event("a"), 0); duplicate(event("b"), 1); duplicate(event("c"), 2);
  expect(duplicate(event("a"), 3)).toBe(false);
});

test("order changes invalidate related finance, stock, calendar and fleet caches", () => {
  const roots = affectedQueryRoots({ type: "RESOURCE_CHANGED", payload: { resource: "orders" } });
  for (const root of ["orders", "payments", "inventory", "invoice", "fleet", "event_query", "dashboard_query"]) expect(roots).toContain(root);
  expect(affectedQueryRoots({ type: "RESOURCE_CHANGED", payload: { resource: "unknown" } })).toEqual([]);
});


test("calendar dates preserve Manila day and wall-clock time across browser timezones", () => {
  const date = parseLocalDateTime("2026-10-30", "09:15");
  expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes()]).toEqual([2026, 9, 30, 9, 15]);
  const midnight = manilaCalendarNow(new Date("2026-10-29T16:30:00Z"));
  expect([midnight.getDate(), midnight.getHours(), midnight.getMinutes()]).toEqual([30, 0, 30]);
});


test("stock and refund changes refresh their new history and operational views", () => {
  const inventory = affectedQueryRoots({ type: "RESOURCE_CHANGED", payload: { resource: "inventory" } });
  for (const root of ["stock-history", "inventory-reorder", "inventory-reconciliation"]) expect(inventory).toContain(root);
  expect(affectedQueryRoots({ type: "RESOURCE_CHANGED", payload: { resource: "payments" } })).toContain("payment-refunds");
});


test("GPS freshness rejects bad coordinates and future clocks, and simulation stays separate", async () => {
  const { resolveVehiclePosition } = await import("../app/(protected)/panel/fleet-map/lib/live.ts");
  const vehicle = { id: "1", warehouseId: "1", stops: [], trip: null, scheduledTrips: [], status: "available", completedStops: 0, legIndex: 0, progress: 0, speed: 20 };
  const warehouses = [{ id: "1", coordinates: [121, 14.5] }];
  const now = Date.parse("2026-10-31T00:00:00Z");
  const fix = { vehicleId: "1", coordinates: [121.1, 14.6], speedKph: 10, heading: 0, recordedAt: new Date(now).toISOString() };
  expect(resolveVehiclePosition(vehicle, warehouses, undefined, false, now).signal).toBe("none");
  expect(resolveVehiclePosition(vehicle, warehouses, fix, false, now).signal).toBe("live");
  expect(resolveVehiclePosition(vehicle, warehouses, { ...fix, recordedAt: new Date(now-180_000).toISOString() }, false, now).signal).toBe("stale");
  expect(resolveVehiclePosition(vehicle, warehouses, { ...fix, recordedAt: new Date(now+60_000).toISOString() }, false, now).signal).toBe("stale");
  expect(resolveVehiclePosition(vehicle, warehouses, { ...fix, coordinates: [NaN, 14] }, false, now).signal).toBe("none");
  expect(resolveVehiclePosition(vehicle, warehouses, fix, true, now).signal).toBe("simulated");
});


test("calendar overlap groups keep adjacent events separate and allocate simultaneous columns", async () => {
  const { layoutOverlappingEvents } = await import("../lib/calendar-layout.ts");
  const at = (time) => new Date(`2026-10-31T${time}:00+08:00`);
  const event = (id, start, end) => ({ id, version: 1, title: String(id), category: "OTHER", date: at("00:00"), start_time: at(start), end_time: at(end) });
  const input = [event(1, "07:00", "08:00"), event(2, "07:30", "08:30"), event(3, "08:30", "09:00")];
  const positioned = layoutOverlappingEvents(input);
  expect(positioned.map((row) => row.columnCount)).toEqual([2, 2, 1]);
  expect(positioned[0].column).not.toBe(positioned[1].column);
  expect(positioned[2].column).toBe(0);
  expect(input.map((row) => row.id)).toEqual([1, 2, 3]);
});


test("financial totals preserve unknown amounts and reject non-decimal strings", () => {
  expect(sumKnownMoney(["0.10", "0.20"])).toBe(0.3);
  expect(sumKnownMoney([0, "0.00"])).toBe(0);
  for (const bad of [null, undefined, "", "invalid", NaN, Infinity, "0x10", "1e3"]) expect(sumKnownMoney([12.34, bad])).toBeNull();
  for (const bad of ["0x10", "1e3", "1,234.00"]) expect(formatCurrency(bad)).toBe("Invalid amount");
});

test("development examples are identified precisely and unavailable in production", async () => {
  const { isPrototypeRoute } = await import("../lib/prototype-routes.ts");
  expect(isPrototypeRoute("/panel/test-7")).toBe(true);
  expect(isPrototypeRoute("/panel/fleet-map-old-but-gold")).toBe(true);
  expect(isPrototypeRoute("/panel/orders")).toBe(false);
  const { proxy } = await import("../proxy.ts"); const { NextRequest } = await import("next/server");
  const environment = process.env.NODE_ENV;
  try { process.env.NODE_ENV = "production"; expect((await proxy(new NextRequest("http://localhost/panel/test-7"))).status).toBe(404); }
  finally { process.env.NODE_ENV = environment; }
});
