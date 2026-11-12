import { DEFAULT_MAP_CENTER, FALLBACK_WAREHOUSE } from "../constants";
import type { Coordinates, Vehicle, WarehouseLocation } from "../types";
import type { RoadRoute } from "./road-routing";

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
  roadRoute?: RoadRoute,
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

  const leg = roadRoute?.legs[vehicle.legIndex];
  // Keep the marker at the last known waypoint until a road route is ready.
  return leg ? pointAlongRoad(leg.coordinates, vehicle.progress) : start;
}

/** Interpolate by distance along the road polyline rather than across the block. */
export function pointAlongRoad(points: Coordinates[], progress: number): Coordinates {
  if (!points.length) throw new Error("A road leg must have coordinates.");
  const lengths = points.slice(1).map((point, index) => distanceMeters(points[index], point));
  let remaining = lengths.reduce((sum, length) => sum + length, 0) * Math.min(1, Math.max(0, progress));
  for (let index = 0; index < lengths.length; index++) {
    const length = lengths[index];
    if (length > 0 && remaining <= length) {
      return interpolate(points[index], points[index + 1], remaining / length);
    }
    remaining -= length;
  }
  return points[points.length - 1];
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

/** Great-circle distance in metres (haversine). */
export function distanceMeters(a: Coordinates, b: Coordinates): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

export function getBounds(
  points: Coordinates[],
): [Coordinates, Coordinates] | null {
  if (points.length === 0) return null;
  const lngs = points.map((point) => point[0]);
  const lats = points.map((point) => point[1]);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}
