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

export function getTripValue(stops: DeliveryStop[]): number {
  return stops.reduce((sum, stop) => sum + stop.order.totalAmount, 0);
}

export function getProgressPercent(vehicle: Vehicle): number {
  if (vehicle.stops.length === 0) return 0;
  return Math.round((vehicle.completedStops / vehicle.stops.length) * 100);
}
