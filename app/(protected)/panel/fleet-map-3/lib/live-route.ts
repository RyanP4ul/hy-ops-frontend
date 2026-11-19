import type {
  Coordinates,
  ResolvedPosition,
  Trip,
  Vehicle,
  WarehouseLocation,
} from "../types";
import { getWarehouse, isValidCoordinate } from "./geometry";
import { getNextPendingStop } from "./vehicle";

/**
 * Planned road waypoints for live vehicles (originating from verified GPS) or
 * scheduled-trip previews (originating from GPS if available, otherwise from
 * the vehicle's assigned home warehouse for planned future departures).
 */
export function liveRoutePoints(
  vehicle: Vehicle,
  warehouses: WarehouseLocation[],
  position: ResolvedPosition | undefined,
  preview?: Trip,
): Coordinates[] {
  if (preview) {
    const pendingTargets = preview.stops
      .filter((stop) => stop.status === "pending")
      .map((stop) => stop.coordinates);
    if (!pendingTargets.length || pendingTargets.some((p) => !isValidCoordinate(p))) {
      return [];
    }
    const origin =
      position &&
      (position.signal === "live" || position.signal === "stale") &&
      isValidCoordinate(position.coordinates)
        ? position.coordinates
        : getWarehouse(vehicle, warehouses).coordinates;
    if (!isValidCoordinate(origin)) return [];
    return [origin, ...pendingTargets];
  }

  if (
    !position ||
    (position.signal !== "live" && position.signal !== "stale") ||
    !isValidCoordinate(position.coordinates)
  ) {
    return [];
  }

  const pickup = vehicle.pickups?.find((task) => task.status === "assigned");
  const targets =
    vehicle.status === "returning"
      ? [warehouses.find((warehouse) => warehouse.id === vehicle.warehouseId)?.coordinates]
      : vehicle.status === "delivering"
        ? [pickup ? pickup.coordinates : getNextPendingStop(vehicle)?.coordinates]
        : [];

  if (!targets.length || targets.some((point) => !isValidCoordinate(point))) {
    return [];
  }

  return [position.coordinates, ...(targets as Coordinates[])];
}
