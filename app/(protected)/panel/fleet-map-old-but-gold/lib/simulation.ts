import type { Vehicle } from "../types";

// Moves the next (or a specific) scheduled trip onto the vehicle and sends it out.
// The trip that just finished is dropped from the vehicle.
export function dispatchNextTrip(vehicle: Vehicle, tripId?: string): Vehicle {
  if (vehicle.status !== "available" || vehicle.blockedReason) return vehicle;

  const next = tripId
    ? vehicle.scheduledTrips.find((trip) => trip.id === tripId)
    : vehicle.scheduledTrips[0];
  if (!next) return vehicle;

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

/** Side effects the simulation produced during one tick; persisted when enabled. */
export type SimulationEvent =
  | { type: "stop-delivered"; stopId: string }
  | { type: "trip-completed"; tripId: string }
  | { type: "trip-dispatched"; tripId: string };

/** Pure diff of two consecutive simulation states into the events that happened between them. */
export function diffTransitions(
  previous: Vehicle[],
  next: Vehicle[],
): SimulationEvent[] {
  const before = new Map(previous.map((vehicle) => [vehicle.id, vehicle]));
  const events: SimulationEvent[] = [];

  for (const vehicle of next) {
    const prev = before.get(vehicle.id);
    if (!prev || !vehicle.trip) continue;

    const sameTrip = prev.trip?.id === vehicle.trip.id;

    if (!sameTrip) {
      // An idle vehicle picked up its next scheduled trip (auto-dispatch).
      if (prev.status === "available" && vehicle.status === "delivering") {
        events.push({ type: "trip-dispatched", tripId: vehicle.trip.id });
      }
      continue;
    }

    const wasPending = new Set(
      prev.stops.filter((s) => s.status === "pending").map((s) => s.id),
    );
    for (const stop of vehicle.stops) {
      if (stop.status === "completed" && wasPending.has(stop.id)) {
        events.push({ type: "stop-delivered", stopId: stop.id });
      }
    }

    if (prev.status !== "available" && vehicle.status === "available") {
      events.push({ type: "trip-completed", tripId: vehicle.trip.id });
    }
  }

  return events;
}

/**
 * Merges a fresh server snapshot into the live local state.
 *
 * The server is the source of truth for everything except the animation. While a vehicle
 * is still on the same trip, the local legIndex/progress/stop statuses win, because the
 * simulation can be ahead of what has been persisted (or persistence is switched off).
 * A different trip id means the server moved on (new dispatch, reassignment), so its
 * snapshot is taken as-is.
 */
export function mergeServerVehicles(
  local: Vehicle[],
  server: Vehicle[],
): Vehicle[] {
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
