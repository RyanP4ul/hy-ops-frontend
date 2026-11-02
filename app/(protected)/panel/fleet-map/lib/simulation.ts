import type { Vehicle } from "../types";

// Moves the next (or a specific) scheduled trip onto the vehicle and sends it out.
// The trip that just finished is dropped from the vehicle.
export function dispatchNextTrip(vehicle: Vehicle, tripId?: string): Vehicle {
  if (vehicle.status !== "available" || vehicle.blockedReason) return vehicle;

  const next = tripId
    ? vehicle.scheduledTrips.find((trip) => trip.id === tripId)
    : vehicle.scheduledTrips[0];
  if (!next || next.phase === "overdue") return vehicle;

  return {
    ...vehicle,
    trip: { id: next.id, label: next.label, scheduledAt: next.scheduledAt },
    stops: next.stops.map((stop) => ({ ...stop, status: "pending" as const })),
    scheduledTrips: vehicle.scheduledTrips.filter(
      (trip) => trip.id !== next.id,
    ),
    completedStops: 0,
    legIndex: 0,
    progress: 0,
    status: "delivering",
    speed: 35,
  };
}

export function advanceVehicle(
  vehicle: Vehicle,
  autoDispatch: boolean,
): Vehicle {
  if (vehicle.status === "available") {
    // Idle at the warehouse: optionally pick up the next scheduled trip.
    return autoDispatch ? dispatchNextTrip(vehicle) : vehicle;
  }

  // Increase movement progress every tick.
  const nextProgress = vehicle.progress + 0.025;

  if (nextProgress < 1) {
    return {
      ...vehicle,
      progress: nextProgress,
      speed: 30 + Math.floor(Math.random() * 16),
    };
  }

  // The vehicle has reached its current destination.
  const nextLegIndex = vehicle.legIndex + 1;

  // Reached a delivery stop.
  if (vehicle.status === "delivering") {
    const arrivedStopIndex = vehicle.legIndex;
    const updatedStops = vehicle.stops.map((stop, index) =>
      index === arrivedStopIndex
        ? { ...stop, status: "completed" as const }
        : stop,
    );

    const completedStops = updatedStops.filter(
      (stop) => stop.status === "completed",
    ).length;

    const allStopsCompleted = updatedStops.every(
      (stop) => stop.status === "completed",
    );

    return {
      ...vehicle,
      stops: updatedStops,
      completedStops,
      legIndex: nextLegIndex,
      progress: 0,
      status: allStopsCompleted ? "returning" : "delivering",
      speed: 35,
    };
  }

  // The vehicle is returning and has reached its warehouse.
  return {
    ...vehicle,
    legIndex: 0,
    progress: 0,
    status: "available",
    speed: 0,
  };
}

/**
 * Brings a fresh server snapshot into local state.
 *
 * Live mode (simulation off): the server is the single source of truth, so the snapshot
 * replaces local state. Simulation mode: while a vehicle is still on the same trip, the
 * locally animated legIndex/progress/stop statuses win, because the animation is ahead
 * of (and never written to) the database. A different trip id means the server moved on.
 */
export function syncVehicles(
  local: Vehicle[],
  server: Vehicle[],
  simulationOn: boolean,
): Vehicle[] {
  if (!simulationOn) return server;

  const localById = new Map(local.map((vehicle) => [vehicle.id, vehicle]));

  return server.map((incoming) => {
    const current = localById.get(incoming.id);
    if (!current || !incoming.trip || current.trip?.id !== incoming.trip.id) {
      return incoming;
    }

    const localStopStatus = new Map(
      current.stops.map((stop) => [stop.id, stop.status] as const),
    );

    return {
      ...incoming,
      status: current.status,
      legIndex: current.legIndex,
      progress: current.progress,
      speed: current.speed,
      completedStops: current.completedStops,
      stops: incoming.stops.map((stop) => ({
        ...stop,
        status:
          localStopStatus.get(stop.id) === "completed"
            ? ("completed" as const)
            : stop.status,
      })),
    };
  });
}
