import { expect, test } from "bun:test";
import { getNextPendingStop } from "../app/(protected)/panel/fleet-map/lib/vehicle";
import { liveRoutePoints } from "../app/(protected)/panel/fleet-map/lib/live-route";
import type { Vehicle, ResolvedPosition, DeliveryStop } from "../app/(protected)/panel/fleet-map/types";

const stop = (id: string, extra: Partial<DeliveryStop> = {}) => ({
  id, status: "pending", coordinates: [121 + Number(id) / 100, 14.5], ...extra,
}) as DeliveryStop;
const vehicle = (stops: DeliveryStop[]) => ({ status: "delivering", stops }) as Vehicle;
const position: ResolvedPosition = {
  coordinates: [121, 14.5], signal: "live", health: "fresh", isEstimated: false,
  speedKph: 0, heading: null, ageMs: 0, recordedAt: new Date().toISOString(),
};

test("fleet next stop and live route follow the synced choice and omit skipped stops", () => {
  const run = vehicle([stop("1", { skippedForNow: true }), stop("2"), stop("3", { deliverNext: true })]);
  expect(getNextPendingStop(run)?.id).toBe("3");
  expect(liveRoutePoints(run, [], position)).toEqual([position.coordinates, run.stops[2].coordinates]);
  run.stops[2].status = "completed";
  expect(getNextPendingStop(run)?.id).toBe("2");
});

test("all skipped stops stay pending and produce no next destination until resumed", () => {
  const run = vehicle([stop("1", { skippedForNow: true }), stop("2", { skippedForNow: true })]);
  expect(getNextPendingStop(run)).toBeUndefined();
  expect(liveRoutePoints(run, [], position)).toEqual([]);
  expect(run.stops.every(s => s.status === "pending")).toBe(true);
  run.stops[1].skippedForNow = false;
  run.stops[1].deliverNext = true;
  expect(getNextPendingStop(run)?.id).toBe("2");
});
