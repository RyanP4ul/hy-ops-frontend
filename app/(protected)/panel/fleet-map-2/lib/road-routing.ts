import { z } from "zod";
import type { Coordinates } from "../types";

export const coordinateSchema = z.tuple([
  z.number().finite().min(-180).max(180),
  z.number().finite().min(-90).max(90),
]);
export const routingWaypointsSchema = z.array(coordinateSchema).min(2).max(100);

const lineSchema = z.object({
  type: z.literal("LineString"),
  coordinates: z.array(coordinateSchema).min(2),
});
const metricSchema = z.number().finite().nonnegative();
const osrmSchema = z.object({
  code: z.literal("Ok"),
  routes: z.array(z.object({
    geometry: lineSchema,
    distance: metricSchema,
    duration: metricSchema,
    legs: z.array(z.object({
      distance: metricSchema,
      duration: metricSchema,
      steps: z.array(z.object({ geometry: lineSchema })).min(1),
    })),
  })).min(1),
});

export type RoadLeg = {
  coordinates: Coordinates[];
  distance: number;
  duration: number;
};
export type RoadRoute = RoadLeg & { legs: RoadLeg[] };

/** Ordered waypoints, including the current GPS origin, identify the road route. */
export function roadRouteKey(points: Coordinates[]): string {
  return points.map((point) => point.join(",")).join(";");
}

export function parseRoadRoute(data: unknown, waypointCount: number): RoadRoute {
  const route = osrmSchema.parse(data).routes[0];
  if (route.legs.length !== waypointCount - 1) {
    throw new Error("The routing service returned an incomplete route.");
  }

  return {
    coordinates: route.geometry.coordinates,
    distance: route.distance,
    duration: route.duration,
    legs: route.legs.map((leg) => ({
      distance: leg.distance,
      duration: leg.duration,
      // OSRM exposes per-leg geometry through its maneuver steps. Remove only
      // shared endpoints, keeping every road vertex and the original stop order.
      coordinates: leg.steps.flatMap((step, index) =>
        index === 0 ? step.geometry.coordinates : step.geometry.coordinates.slice(1),
      ),
    })),
  };
}
