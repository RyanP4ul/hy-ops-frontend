import {
  CO_LOCATION_RADIUS_M,
  DEFAULT_MAP_CENTER,
  FALLBACK_WAREHOUSE,
} from "../constants";
import type {
  Coordinates,
  ResolvedPosition,
  Vehicle,
  WarehouseLocation,
} from "../types";
import type { RoadRoute } from "./road-routing";

export function isValidCoordinate(
  point: Coordinates | null | undefined,
): point is Coordinates {
  return (
    Array.isArray(point) &&
    point.length === 2 &&
    Number.isFinite(point[0]) &&
    Number.isFinite(point[1]) &&
    Math.abs(point[0]) <= 180 &&
    Math.abs(point[1]) <= 90
  );
}

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
  return leg ? pointAlongRoad(leg.coordinates, vehicle.progress) : start;
}

/** Interpolate by distance along the road polyline rather than across the block. */
export function pointAlongRoad(
  points: Coordinates[],
  progress: number,
): Coordinates {
  if (!points.length) throw new Error("A road leg must have coordinates.");
  const lengths = points
    .slice(1)
    .map((point, index) => distanceMeters(points[index], point));
  let remaining =
    lengths.reduce((sum, length) => sum + length, 0) *
    Math.min(1, Math.max(0, progress));
  for (let index = 0; index < lengths.length; index++) {
    const length = lengths[index];
    if (length > 0 && remaining <= length) {
      return interpolate(points[index], points[index + 1], remaining / length);
    }
    remaining -= length;
  }
  return points[points.length - 1];
}

/** Great-circle distance in metres (haversine). */
export function distanceMeters(a: Coordinates, b: Coordinates): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(Math.min(1, h)));
}

export function getBounds(
  points: Coordinates[],
): [Coordinates, Coordinates] | null {
  const valid = points.filter(isValidCoordinate);
  if (valid.length === 0) return null;
  const lngs = valid.map((point) => point[0]);
  const lats = valid.map((point) => point[1]);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}

export type CoLocatedVehicleGroup = {
  key: string;
  coordinates: Coordinates;
  vehicles: Vehicle[];
};

/**
 * Groups vehicles sharing identical or very close coordinates without altering
 * their underlying coordinates, preventing unreadable stacked markers.
 */
export function clusterCoLocatedVehicles(
  vehicles: Vehicle[],
  positions: Map<string, ResolvedPosition>,
  selectedId: string | null,
  radiusMeters = CO_LOCATION_RADIUS_M,
): CoLocatedVehicleGroup[] {
  const groups: CoLocatedVehicleGroup[] = [];

  for (const vehicle of vehicles) {
    const pos = positions.get(vehicle.id);
    if (!pos || !isValidCoordinate(pos.coordinates)) continue;

    const existing = groups.find(
      (group) => distanceMeters(group.coordinates, pos.coordinates) <= radiusMeters,
    );
    if (existing) {
      existing.vehicles.push(vehicle);
    } else {
      groups.push({
        key: `cluster-${vehicle.id}`,
        coordinates: pos.coordinates,
        vehicles: [vehicle],
      });
    }
  }

  // Sort so groups containing the selected vehicle render last (highest z-order).
  return groups.sort((a, b) => {
    const aSelected = a.vehicles.some((v) => v.id === selectedId);
    const bSelected = b.vehicles.some((v) => v.id === selectedId);
    return Number(aSelected) - Number(bSelected);
  });
}
