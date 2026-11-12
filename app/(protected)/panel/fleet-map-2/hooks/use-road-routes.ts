import { useQueries } from "@tanstack/react-query";
import { getRoute, getWarehouse } from "../lib/geometry";
import { roadRouteKey, type RoadRoute } from "../lib/road-routing";
import { liveRoutePoints } from "../lib/live-route";
import { resolveVehiclePosition } from "../lib/live";
import type { Coordinates, LivePosition, Trip, Vehicle, WarehouseLocation } from "../types";

export function useRoadRoutes(
  vehicles: Vehicle[],
  warehouses: WarehouseLocation[],
  selectedId: string | null,
  previewTrip: { trip: Trip; vehicle: Vehicle } | null,
  livePositions: Map<string, LivePosition>,
  simulationOn: boolean,
  now: number,
) {
  const vehicleKeys = new Map<string, string>();
  const requests = new Map<string, Coordinates[]>();
  for (const vehicle of vehicles) {
    if ((!vehicle.stops.length && !vehicle.pickups?.length) || (vehicle.status === "available" && vehicle.id !== selectedId)) continue;
    const points = simulationOn ? getRoute(vehicle, warehouses) : liveRoutePoints(
      vehicle, warehouses, resolveVehiclePosition(vehicle, warehouses, livePositions.get(vehicle.id), false, now),
    );
    if (points.length < 2) continue;
    const key = roadRouteKey(points);
    vehicleKeys.set(vehicle.id, key);
    requests.set(key, points);
  }

  let previewKey: string | undefined;
  if (previewTrip?.trip.stops.length) {
    const warehouse = getWarehouse(previewTrip.vehicle, warehouses).coordinates;
    const points = simulationOn
      ? [warehouse, ...previewTrip.trip.stops.map((stop) => stop.coordinates), warehouse]
      : liveRoutePoints(previewTrip.vehicle, warehouses, resolveVehiclePosition(previewTrip.vehicle, warehouses, livePositions.get(previewTrip.vehicle.id), false, now), previewTrip.trip);
    if (points.length >= 2) {
      previewKey = roadRouteKey(points);
      requests.set(previewKey, points);
    }
  }
  const keys = [...requests.keys()];
  const queries = useQueries({
    queries: keys.map((key) => ({
      queryKey: ["fleet-road-route", key],
      queryFn: async ({ signal }: { signal: AbortSignal }): Promise<RoadRoute> => {
        const response = await fetch(`/panel/fleet-map/road-route?${new URLSearchParams({ waypoints: key })}`, { signal });
        if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
          throw new Error("Road routing is unavailable.");
        }
        return response.json();
      },
      staleTime: 60 * 60 * 1000,
      gcTime: simulationOn ? 60 * 60 * 1000 : 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    })),
  });
  const routes = new Map(keys.map((key, index) => [key, queries[index].data]));

  return {
    byVehicle: new Map([...vehicleKeys].map(([id, key]) => [id, routes.get(key)])),
    preview: previewKey ? routes.get(previewKey) : undefined,
    isPending: queries.some((query) => query.isPending),
    isError: queries.some((query) => query.isError),
    retry: () => { queries.filter((query) => query.isError).forEach((query) => { void query.refetch(); }); },
  };
}
