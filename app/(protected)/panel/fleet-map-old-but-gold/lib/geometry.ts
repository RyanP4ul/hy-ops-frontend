import { DEFAULT_MAP_CENTER, FALLBACK_WAREHOUSE } from "../constants";
import type { Coordinates, Vehicle, WarehouseLocation } from "../types";

export function interpolate(
  start: Coordinates,
  end: Coordinates,
  progress: number,
): Coordinates {
  return [
    start[0] + (end[0] - start[0]) * progress,
    start[1] + (end[1] - start[1]) * progress,
  ];
}

export function getWarehouse(
  vehicle: Vehicle,
  warehouses: WarehouseLocation[],
): WarehouseLocation {
  return (
    warehouses.find((warehouse) => warehouse.id === vehicle.warehouseId) ??
    warehouses[0] ??
    FALLBACK_WAREHOUSE
  );
}

// Route: assigned warehouse -> delivery stops -> assigned warehouse.
export function getRoute(
  vehicle: Vehicle,
  warehouses: WarehouseLocation[],
): Coordinates[] {
  const warehouse = getWarehouse(vehicle, warehouses);

  return [
    warehouse.coordinates,
    ...vehicle.stops.map((stop) => stop.coordinates),
    warehouse.coordinates,
  ];
}

export function getPosition(
  vehicle: Vehicle,
  warehouses: WarehouseLocation[],
): Coordinates {
  const warehouse = getWarehouse(vehicle, warehouses);
  const fallback: Coordinates = warehouse.coordinates ?? DEFAULT_MAP_CENTER;
  const route = getRoute(vehicle, warehouses);

  if (vehicle.status === "available") {
    return fallback;
  }

  const start = route[vehicle.legIndex];
  const end = route[vehicle.legIndex + 1];

  if (!start || !end) {
    return fallback;
  }

  return interpolate(start, end, vehicle.progress);
}

export function getNextDestination(
  vehicle: Vehicle,
  warehouses: WarehouseLocation[],
) {
  if (vehicle.status === "available" || vehicle.status === "returning") {
    return getWarehouse(vehicle, warehouses);
  }

  return vehicle.stops[vehicle.legIndex];
}
