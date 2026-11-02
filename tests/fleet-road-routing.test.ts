import { afterEach, expect, spyOn, test } from "bun:test";
import { GET } from "../app/(protected)/panel/fleet-map/road-route/route";
import { parseRoadRoute, roadRouteKey, type RoadRoute } from "../app/(protected)/panel/fleet-map/lib/road-routing";
import { getPosition, pointAlongRoad } from "../app/(protected)/panel/fleet-map/lib/geometry";
import { resolveVehiclePosition } from "../app/(protected)/panel/fleet-map/lib/live";
import { liveRoutePoints } from "../app/(protected)/panel/fleet-map/lib/live-route";
import type { ResolvedPosition, Trip } from "../app/(protected)/panel/fleet-map/types";
import type { Coordinates, Vehicle, WarehouseLocation } from "../app/(protected)/panel/fleet-map/types";

const warehouse: Coordinates = [121, 14.5];
const corner: Coordinates = [121.01, 14.5];
const stop: Coordinates = [121.01, 14.51];
const returnCorner: Coordinates = [121, 14.51];
const line = (coordinates: Coordinates[]) => ({ type: "LineString", coordinates });
const providerResponse = () => ({ code: "Ok", routes: [{
  geometry: line([warehouse, corner, stop, returnCorner, warehouse]),
  distance: 4400, duration: 400,
  legs: [
    { distance: 2200, duration: 200, steps: [{ geometry: line([warehouse, corner]) }, { geometry: line([corner, stop]) }] },
    { distance: 2200, duration: 200, steps: [{ geometry: line([stop, returnCorner, warehouse]) }] },
  ],
}] });
const road = () => parseRoadRoute(providerResponse(), 3);
const vehicle = {
  id: "1", warehouseId: "1", status: "delivering", legIndex: 0, progress: 0.25,
  speed: 35, stops: [{ id: "stop", coordinates: stop }],
} as Vehicle;
const warehouses = [{ id: "1", coordinates: warehouse }] as WarehouseLocation[];
const originalProvider = process.env.OSRM_ROUTING_URL;
let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, "fetch">> | undefined;

afterEach(() => {
  fetchSpy?.mockRestore();
  fetchSpy = undefined;
  if (originalProvider === undefined) delete process.env.OSRM_ROUTING_URL;
  else process.env.OSRM_ROUTING_URL = originalProvider;
});

test("road geometry retains bends, stop boundaries and a different return road", () => {
  const route = road();
  expect(route.legs[0].coordinates).toEqual([warehouse, corner, stop]);
  expect(route.legs[1].coordinates).toEqual([stop, returnCorner, warehouse]);
  expect(route.coordinates).toHaveLength(5);
  expect(route.distance).toBe(4400);
});

test("simulation follows road distance and return legs while GPS stays unchanged", () => {
  const position = getPosition(vehicle, warehouses, road());
  expect(position[0]).toBeGreaterThan(warehouse[0]);
  expect(position[0]).toBeLessThan(corner[0]);
  expect(position[1]).toBe(warehouse[1]);
  const returning = getPosition({ ...vehicle, status: "returning", legIndex: 1 }, warehouses, road());
  expect(returning[1]).toBe(stop[1]);
  expect(returning[0]).toBeLessThan(stop[0]);

  const now = Date.now();
  const gps = { vehicleId: "1", coordinates: [121.005, 14.507] as Coordinates, speedKph: 20, heading: 90, recordedAt: new Date(now).toISOString() };
  expect(resolveVehiclePosition(vehicle, warehouses, gps, false, now, road()).coordinates).toEqual(gps.coordinates);
  expect(resolveVehiclePosition(vehicle, warehouses, gps, true, now, road()).coordinates).toEqual(position);
});

test("missing road geometry keeps the marker at its leg start", () => {
  expect(getPosition(vehicle, warehouses)).toEqual(warehouse);
  expect(getPosition({ ...vehicle, legIndex: 1, status: "returning" }, warehouses)).toEqual(stop);
});

test("polyline interpolation handles endpoints, repeated vertices and zero distance", () => {
  const points = [warehouse, warehouse, corner, stop];
  expect(pointAlongRoad(points, -1)).toEqual(warehouse);
  expect(pointAlongRoad(points, 2)).toEqual(stop);
  expect(pointAlongRoad([warehouse, warehouse], 0.5)).toEqual(warehouse);
});

test("unroutable or incomplete provider responses cannot become straight-line routes", () => {
  expect(() => parseRoadRoute({ code: "NoRoute" }, 3)).toThrow();
  expect(() => parseRoadRoute(providerResponse(), 4)).toThrow("incomplete");
  const malformed = providerResponse();
  malformed.routes[0].legs[0].steps[0].geometry.coordinates[0] = [NaN, 14];
  expect(() => parseRoadRoute(malformed, 3)).toThrow();
});

test("cache keys retain waypoint order and the return to warehouse", () => {
  expect(roadRouteKey([warehouse, stop, warehouse])).not.toBe(roadRouteKey([stop, warehouse, stop]));
  expect(roadRouteKey([warehouse, stop, warehouse])).not.toBe(roadRouteKey([warehouse, stop]));
});

test("the server rejects malformed coordinates before contacting a provider", async () => {
  fetchSpy = spyOn(globalThis, "fetch");
  for (const value of ["", "121,14", "181,14;121,14", "121,91;121,14", "121,;121,14", "NaN,14;121,14", "121,14,1;121,14"]) {
    const response = await GET(new Request(`http://localhost/panel/fleet-map/road-route?${new URLSearchParams({ waypoints: value })}`));
    expect(response.status).toBe(400);
  }
  expect(fetchSpy).not.toHaveBeenCalled();
});

test("the server requests full driving geometry and returns all ordered road legs", async () => {
  process.env.OSRM_ROUTING_URL = "https://routing.example.test/osrm/";
  fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(Response.json(providerResponse()));
  const response = await GET(new Request(`http://localhost/panel/fleet-map/road-route?${new URLSearchParams({ waypoints: roadRouteKey([warehouse, stop, warehouse]) })}`));
  expect(response.status).toBe(200);
  const route = await response.json() as RoadRoute;
  expect(route.legs[0].coordinates).toEqual([warehouse, corner, stop]);
  const url = new URL(String(fetchSpy.mock.calls[0][0]));
  expect(url.pathname).toBe(`/osrm/route/v1/driving/${roadRouteKey([warehouse, stop, warehouse])}`);
  expect(url.searchParams.get("geometries")).toBe("geojson");
  expect(url.searchParams.get("overview")).toBe("full");
  expect(url.searchParams.get("steps")).toBe("true");
});

test("routing outages and NoRoute responses return an error without invented geometry", async () => {
  process.env.OSRM_ROUTING_URL = "https://routing.example.test";
  const request = () => new Request("http://localhost/panel/fleet-map/road-route?waypoints=121,14;121.1,14.1");
  fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ code: "NoRoute" }));
  expect((await GET(request())).status).toBe(502);
  fetchSpy.mockResolvedValue(new Response("Unavailable", { status: 503 }));
  const response = await GET(request());
  expect(response.status).toBe(502);
  expect(await response.json()).not.toHaveProperty("coordinates");
});

const gpsPosition = (coordinates: Coordinates = [121.005, 14.505]): ResolvedPosition => ({ coordinates, signal: "live", speedKph: 20, heading: 90, ageMs: 1000 });
const activeVehicle = () => ({ ...vehicle, stops: [
  { ...vehicle.stops[0], status: "completed" as const },
  { ...vehicle.stops[0], id: "next", status: "pending" as const, coordinates: [121.03, 14.53] as Coordinates },
  { ...vehicle.stops[0], id: "later", status: "pending" as const, coordinates: [121.04, 14.54] as Coordinates },
] });

test("live routing starts at the vehicle GPS and targets only the next pending customer", () => {
  const current = activeVehicle();
  const points = liveRoutePoints(current, warehouses, gpsPosition());
  expect(points).toEqual([gpsPosition().coordinates, current.stops[1].coordinates]);
  expect(points).not.toContainEqual(warehouse);
  expect(points).not.toContainEqual(current.stops[0].coordinates);
  expect(points).not.toContainEqual(current.stops[2].coordinates);
  const moved = liveRoutePoints(current, warehouses, gpsPosition([121.006, 14.506]));
  expect(moved[0]).toEqual([121.006, 14.506]);
  expect(roadRouteKey(moved)).not.toBe(roadRouteKey(points));
  current.stops[1].status = "completed";
  expect(liveRoutePoints(current, warehouses, gpsPosition())[1]).toEqual(current.stops[2].coordinates);
});

test("return routing starts at vehicle GPS and goes to its assigned warehouse", () => {
  expect(liveRoutePoints({ ...activeVehicle(), status: "returning" }, warehouses, gpsPosition())).toEqual([gpsPosition().coordinates, warehouse]);
  expect(liveRoutePoints({ ...activeVehicle(), status: "returning", warehouseId: "missing" }, warehouses, gpsPosition())).toEqual([]);
});

test("unknown/estimated GPS or invalid endpoints do not invent a warehouse-origin route", () => {
  for (const signal of ["none", "simulated"] as const) expect(liveRoutePoints(activeVehicle(), warehouses, { ...gpsPosition(), signal })).toEqual([]);
  expect(liveRoutePoints(activeVehicle(), warehouses, undefined)).toEqual([]);
  expect(liveRoutePoints(activeVehicle(), warehouses, gpsPosition([Infinity, 14]))).toEqual([]);
  const invalid = activeVehicle(); invalid.stops[1].coordinates = [121, NaN];
  expect(liveRoutePoints(invalid, warehouses, gpsPosition())).toEqual([]);
  expect(liveRoutePoints(activeVehicle(), warehouses, { ...gpsPosition(), signal: "stale" })).toHaveLength(2);
});

test("scheduled preview uses the vehicle GPS before its ordered customer destinations", () => {
  const preview = { stops: activeVehicle().stops.slice(1) } as Trip;
  expect(liveRoutePoints(vehicle, warehouses, gpsPosition(), preview)).toEqual([gpsPosition().coordinates, ...preview.stops.map(s => s.coordinates)]);
  expect(liveRoutePoints(vehicle, warehouses, undefined, preview)).toEqual([]);
});


test("assigned returns route from vehicle GPS; collected returns use warehouse route", () => {
  const pickup = { id: 1, orderNumber: "RETURN-1", customer: "Customer", address: "Saved address", status: "assigned", version: 2, coordinates: [121.2, 14.7] as Coordinates | null };
  const current: Vehicle = { ...activeVehicle(), pickups: [pickup] };
  expect(liveRoutePoints(current, warehouses, gpsPosition())).toEqual([gpsPosition().coordinates, pickup.coordinates!]);
  pickup.coordinates = null;
  expect(liveRoutePoints(current, warehouses, gpsPosition())).toEqual([]);
  pickup.status = "collected";
  expect(liveRoutePoints({ ...current, status: "returning", stops: [] }, warehouses, gpsPosition())).toEqual([gpsPosition().coordinates, warehouse]);
});
