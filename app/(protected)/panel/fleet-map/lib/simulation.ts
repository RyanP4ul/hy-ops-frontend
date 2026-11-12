import type { Vehicle } from "../types";

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
    return autoDispatch ? dispatchNextTrip(vehicle) : vehicle;
  }

  const nextProgress = vehicle.progress + 0.025;

  if (nextProgress < 1) {
    return {
      ...vehicle,
      progress: nextProgress,
      speed: 30 + Math.floor(Math.random() * 16),
    };
  }

  const nextLegIndex = vehicle.legIndex + 1;

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

  return {
    ...vehicle,
    legIndex: 0,
    progress: 0,
    status: "available",
    speed: 0,
  };
}

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
