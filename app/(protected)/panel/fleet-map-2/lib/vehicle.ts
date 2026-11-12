import type { DeliveryStop, Vehicle } from "../types";

export function isRouteComplete(vehicle: Vehicle): boolean {
  // This route includes the return leg, so it is complete when all stops are done
  // and the vehicle has returned to its assigned warehouse.
  return (
    vehicle.status === "available" &&
    vehicle.stops.length > 0 &&
    vehicle.stops.every((stop) => stop.status === "completed")
  );
}

export function isAvailableVehicle(
  vehicle: Pick<Vehicle, "status" | "blockedReason">,
): boolean {
  return vehicle.status === "available" && vehicle.blockedReason === undefined;
}

export function getTripValue(stops: DeliveryStop[]): number | null {
  if (stops.some((stop) => stop.order.totalAmount === null)) return null;
  return stops.reduce((sum, stop) => sum + (stop.order.totalAmount ?? 0), 0);
}

export function getProgressPercent(vehicle: Vehicle): number {
  if (vehicle.stops.length === 0) return 0;
  return Math.round((vehicle.completedStops / vehicle.stops.length) * 100);
}

/** First stop that hasn't been delivered yet (the one the vehicle is heading to). */
export function getNextPendingStop(vehicle: Vehicle): DeliveryStop | undefined {
  return vehicle.stops.find((stop) => stop.status === "pending");
}

export type VehicleFilter = "all" | "delivering" | "returning" | "available";

export function matchesFilter(
  vehicle: Vehicle,
  filter: VehicleFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "available") return isAvailableVehicle(vehicle);
  return vehicle.status === filter;
}

export function matchesSearch(vehicle: Vehicle, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  return (
    vehicle.plate.toLowerCase().includes(q) ||
    vehicle.driver.toLowerCase().includes(q) ||
    vehicle.stops.some(
      (stop) =>
        stop.name.toLowerCase().includes(q) ||
        stop.order.id.toLowerCase().includes(q) ||
        stop.order.customer.name.toLowerCase().includes(q),
    )
  );
}

const STATUS_ORDER: Record<Vehicle["status"], number> = {
  delivering: 0,
  returning: 1,
  available: 2,
};

/** Active vehicles first, then by plate. */
export function compareVehicles(a: Vehicle, b: Vehicle): number {
  return (
    STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
    a.plate.localeCompare(b.plate)
  );
}
