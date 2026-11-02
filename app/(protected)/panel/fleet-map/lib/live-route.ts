import type { Coordinates, ResolvedPosition, Trip, Vehicle, WarehouseLocation } from "../types";
import { getNextPendingStop } from "./vehicle";

const valid = (point: Coordinates) => point.every(Number.isFinite) && Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 90;

/** Live routes begin at an actual GPS fix, never an estimated warehouse marker. */
export function liveRoutePoints(
  vehicle: Vehicle,
  warehouses: WarehouseLocation[],
  position: ResolvedPosition | undefined,
  preview?: Trip,
): Coordinates[] {
  if (!position || !["live", "stale"].includes(position.signal) || !valid(position.coordinates)) return [];
  const pickup = vehicle.pickups?.find(task => task.status === "assigned");
  const targets = preview
    ? preview.stops.filter(stop => stop.status === "pending").map(stop => stop.coordinates)
    : vehicle.status === "returning"
      ? [warehouses.find(warehouse => warehouse.id === vehicle.warehouseId)?.coordinates]
      : vehicle.status === "delivering"
        ? [pickup ? pickup.coordinates : getNextPendingStop(vehicle)?.coordinates]
        : [];
  if (!targets.length || targets.some(point => !point || !valid(point))) return [];
  return [position.coordinates, ...targets as Coordinates[]];
}
