import { afterEach, expect, spyOn, test } from "bun:test";
import { GET } from "../app/(protected)/panel/fleet-map-1/road-route/route";
import {
  GPS_FRESH_MS,
  GPS_STALE_MS,
} from "../app/(protected)/panel/fleet-map-1/constants";
import {
  clusterCoLocatedVehicles,
  getBounds,
  pointAlongRoad,
} from "../app/(protected)/panel/fleet-map-1/lib/geometry";
import {
  mergeMonotonicPositions,
  resolveVehiclePosition,
} from "../app/(protected)/panel/fleet-map-1/lib/live";
import { liveRoutePoints } from "../app/(protected)/panel/fleet-map-1/lib/live-route";
import {
  parseRoadRoute,
  roadRouteKey,
  type RoadRoute,
} from "../app/(protected)/panel/fleet-map-1/lib/road-routing";
import {
  compareVehicles,
  computeFleetCounts,
  groupStopsByVerifiedDestination,
  matchesFilter,
  matchesSearch,
} from "../app/(protected)/panel/fleet-map-1/lib/vehicle";
import type {
  Coordinates,
  DeliveryStop,
  LivePosition,
  ResolvedPosition,
  StopEnrichment,
  Trip,
  Vehicle,
  WarehouseLocation,
} from "../app/(protected)/panel/fleet-map-1/types";

const warehouse: Coordinates = [121, 14.5];
const corner: Coordinates = [121.01, 14.5];
const stopCoord: Coordinates = [121.01, 14.51];
const returnCorner: Coordinates = [121, 14.51];

const warehouses: WarehouseLocation[] = [
  {
    id: "1",
    name: "Main Hub",
    address: "1 Main St",
    streetAddress: "1 Main St",
    city: "Manila",
    state: "NCR",
    zipCode: "1000",
    coordinates: warehouse,
  },
];

function makeStop(overrides: Partial<DeliveryStop> = {}): DeliveryStop {
  return {
    id: "10",
    name: "Customer A",
    address: "123 Market Rd",
    coordinates: stopCoord,
    status: "pending",
    order: {
      id: "ORD-1001",
      customer: { name: "Customer A", code: "CUS-0001", phone: "09171234567" },
      paymentArrangement: "NET_30",
      paymentMethod: null,
      totalAmount: 1000,
      amountPaid: 0,
      items: [],
    },
    ...overrides,
  };
}

function makeVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: "1",
    driver: "Driver One",
    plate: "ABC-101",
    color: "#2563eb",
    warehouseId: "1",
    trip: null,
    stops: [],
    scheduledTrips: [],
    legIndex: 0,
    progress: 0,
    completedStops: 0,
    status: "available",
    speed: 0,
    ...overrides,
  };
}

const line = (coordinates: Coordinates[]) => ({
  type: "LineString",
  coordinates,
});
const providerResponse = () => ({
  code: "Ok",
  routes: [
    {
      geometry: line([warehouse, corner, stopCoord, returnCorner, warehouse]),
      distance: 4400,
      duration: 420,
      legs: [
        {
          distance: 2200,
          duration: 210,
          steps: [
            { geometry: line([warehouse, corner]) },
            { geometry: line([corner, stopCoord]) },
          ],
        },
        {
          distance: 2200,
          duration: 210,
          steps: [{ geometry: line([stopCoord, returnCorner, warehouse]) }],
        },
      ],
    },
  ],
});

const originalProvider = process.env.OSRM_ROUTING_URL;
let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, "fetch">> | undefined;

afterEach(() => {
  fetchSpy?.mockRestore();
  fetchSpy = undefined;
  if (originalProvider === undefined) delete process.env.OSRM_ROUTING_URL;
  else process.env.OSRM_ROUTING_URL = originalProvider;
});

test("GPS freshness separates fresh, delayed, stale, invalid, none, and simulated states", () => {
  const now = Date.parse("2026-11-11T08:00:00Z");
  const maintenanceVehicle = makeVehicle({
    status: "available",
    blockedReason: "maintenance",
  });
  const baseFix: LivePosition = {
    vehicleId: "1",
    coordinates: [121.02, 14.52],
    speedKph: 25,
    heading: 90,
    recordedAt: new Date(now - 10_000).toISOString(),
  };

  const fresh = resolveVehiclePosition(
    maintenanceVehicle,
    warehouses,
    baseFix,
    false,
    now,
  );
  expect(fresh.health).toBe("fresh");
  expect(fresh.signal).toBe("live");
  expect(fresh.isEstimated).toBe(false);

  const delayed = resolveVehiclePosition(
    maintenanceVehicle,
    warehouses,
    { ...baseFix, recordedAt: new Date(now - GPS_FRESH_MS - 5_000).toISOString() },
    false,
    now,
  );
  expect(delayed.health).toBe("delayed");
  expect(delayed.signal).toBe("live");

  const stale = resolveVehiclePosition(
    maintenanceVehicle,
    warehouses,
    { ...baseFix, recordedAt: new Date(now - GPS_STALE_MS - 5_000).toISOString() },
    false,
    now,
  );
  expect(stale.health).toBe("stale");
  expect(stale.signal).toBe("stale");

  const missing = resolveVehiclePosition(
    maintenanceVehicle,
    warehouses,
    undefined,
    false,
    now,
  );
  expect(missing.health).toBe("none");
  expect(missing.signal).toBe("none");
  expect(missing.isEstimated).toBe(true);

  const future = resolveVehiclePosition(
    maintenanceVehicle,
    warehouses,
    { ...baseFix, recordedAt: new Date(now + 60_000).toISOString() },
    false,
    now,
  );
  expect(future.health).toBe("stale");

  const simulated = resolveVehiclePosition(
    maintenanceVehicle,
    warehouses,
    baseFix,
    true,
    now,
  );
  expect(simulated.health).toBe("simulated");
  expect(simulated.signal).toBe("simulated");
});

test("mergeMonotonicPositions rejects out-of-order older GPS fixes", () => {
  const t1 = "2026-11-11T08:00:00.000Z";
  const t2 = "2026-11-11T08:01:00.000Z";
  const newer: LivePosition = {
    vehicleId: "1",
    coordinates: [121.05, 14.55],
    speedKph: 30,
    heading: 10,
    recordedAt: t2,
  };
  const older: LivePosition = {
    vehicleId: "1",
    coordinates: [121.01, 14.51],
    speedKph: 10,
    heading: 0,
    recordedAt: t1,
  };

  const first = mergeMonotonicPositions(new Map(), [newer]);
  expect(first.get("1")?.coordinates).toEqual([121.05, 14.55]);

  const afterOutOfOrder = mergeMonotonicPositions(first, [older]);
  expect(afterOutOfOrder.get("1")?.coordinates).toEqual([121.05, 14.55]);
  expect(afterOutOfOrder.get("1")?.recordedAt).toBe(t2);
});

test("fleet counts account for all operational states without gaps", () => {
  const now = Date.parse("2026-11-11T08:00:00Z");
  const fleet: Vehicle[] = [
    makeVehicle({ id: "1", plate: "A-1", status: "delivering" }),
    makeVehicle({ id: "2", plate: "B-2", status: "returning" }),
    makeVehicle({ id: "3", plate: "C-3", status: "available" }),
    makeVehicle({
      id: "4",
      plate: "D-4",
      status: "available",
      blockedReason: "maintenance",
    }),
    makeVehicle({
      id: "5",
      plate: "E-5",
      status: "available",
      blockedReason: "unavailable",
    }),
  ];
  const positions = new Map<string, ResolvedPosition>(
    fleet.map((v) => [
      v.id,
      resolveVehiclePosition(
        v,
        warehouses,
        v.id === "2"
          ? {
              vehicleId: "2",
              coordinates: [121.01, 14.51],
              speedKph: 20,
              heading: 0,
              recordedAt: new Date(now - 5_000).toISOString(),
            }
          : undefined,
        false,
        now,
      ),
    ]),
  );

  const counts = computeFleetCounts(fleet, positions);
  expect(counts.total).toBe(5);
  expect(
    counts.delivering + counts.returning + counts.available + counts.blocked,
  ).toBe(counts.total);
  expect(counts.blocked).toBe(2);
  // Delivering vehicle (#1) has no GPS + blocked vehicles (#4, #5) have no GPS
  expect(counts.gpsAttention).toBe(3);
  expect(matchesFilter(fleet[3], "available")).toBe(false);
  expect(matchesFilter(fleet[3], "blocked")).toBe(true);
});

test("clusterCoLocatedVehicles groups nearby units without altering coordinates", () => {
  const now = Date.parse("2026-11-11T08:00:00Z");
  const v1 = makeVehicle({ id: "1", plate: "V-1" });
  const v2 = makeVehicle({ id: "2", plate: "V-2" });
  const v3 = makeVehicle({ id: "3", plate: "V-3" });
  const pos = new Map<string, ResolvedPosition>([
    ["1", resolveVehiclePosition(v1, warehouses, undefined, false, now)],
    ["2", resolveVehiclePosition(v2, warehouses, undefined, false, now)],
    [
      "3",
      resolveVehiclePosition(
        v3,
        warehouses,
        {
          vehicleId: "3",
          coordinates: [121.05, 14.55],
          speedKph: 40,
          heading: 0,
          recordedAt: new Date(now).toISOString(),
        },
        false,
        now,
      ),
    ],
  ]);

  const clusters = clusterCoLocatedVehicles([v1, v2, v3], pos, "2");
  expect(clusters).toHaveLength(2);
  const warehouseCluster = clusters.find((c) => c.vehicles.length === 2);
  expect(warehouseCluster?.coordinates).toEqual(warehouse);
  expect(clusters[clusters.length - 1].vehicles.some((v) => v.id === "2")).toBe(
    true,
  );
});

test("groupStopsByVerifiedDestination groups verified same-location stops and never groups by customer name alone", () => {
  const stop1 = makeStop({
    id: "1",
    name: "Same Customer",
    address: "100 Rizal Ave",
    coordinates: [121.02, 14.52],
    order: { ...makeStop().order, id: "ORD-1" },
  });
  const stop2 = makeStop({
    id: "2",
    name: "Same Customer",
    address: "100 Rizal Ave",
    coordinates: [121.02, 14.52],
    status: "completed",
    order: { ...makeStop().order, id: "ORD-2" },
  });
  const stop3 = makeStop({
    id: "3",
    name: "Same Customer",
    address: "200 Different St",
    coordinates: [121.04, 14.54],
    order: { ...makeStop().order, id: "ORD-3" },
  });

  const enrichment = new Map<string, StopEnrichment>([
    [
      "1",
      {
        stopId: "1",
        orderId: 1,
        orderNumber: "ORD-1",
        actualStatus: "pending",
        failureReason: null,
        orderGroupId: "grp-1",
        orderGroupNumber: "GRP-001",
        orderGroupPosition: 1,
        returnId: null,
        returnStatus: null,
      },
    ],
    [
      "2",
      {
        stopId: "2",
        orderId: 2,
        orderNumber: "ORD-2",
        actualStatus: "failed",
        failureReason: "Customer unavailable",
        orderGroupId: "grp-1",
        orderGroupNumber: "GRP-001",
        orderGroupPosition: 2,
        returnId: null,
        returnStatus: null,
      },
    ],
  ]);

  const groups = groupStopsByVerifiedDestination(
    [stop1, stop2, stop3],
    enrichment,
  );
  expect(groups).toHaveLength(2);
  expect(groups[0].entries.map((e) => e.stop.order.id)).toEqual([
    "ORD-1",
    "ORD-2",
  ]);
  expect(groups[0].orderGroupNumber).toBe("GRP-001");
  expect(groups[0].entries[1].enrichment?.actualStatus).toBe("failed");
  expect(groups[1].entries.map((e) => e.stop.order.id)).toEqual(["ORD-3"]);
});

test("vehicle sorting respects user-selected sort without unexpected overrides", () => {
  const now = Date.parse("2026-11-11T08:00:00Z");
  const idleGood = makeVehicle({ id: "1", plate: "AAA-111", status: "available" });
  const activeNoGps = makeVehicle({ id: "2", plate: "ZZZ-999", status: "delivering" });
  const activeFresh = makeVehicle({ id: "3", plate: "BBB-222", status: "delivering" });

  const positions = new Map<string, ResolvedPosition>([
    [
      "1",
      resolveVehiclePosition(
        idleGood,
        warehouses,
        {
          vehicleId: "1",
          coordinates: warehouse,
          speedKph: 0,
          heading: null,
          recordedAt: new Date(now).toISOString(),
        },
        false,
        now,
      ),
    ],
    ["2", resolveVehiclePosition(activeNoGps, warehouses, undefined, false, now)],
    [
      "3",
      resolveVehiclePosition(
        activeFresh,
        warehouses,
        {
          vehicleId: "3",
          coordinates: [121.01, 14.51],
          speedKph: 30,
          heading: 45,
          recordedAt: new Date(now).toISOString(),
        },
        false,
        now,
      ),
    ],
  ]);

  const byPriority = [idleGood, activeFresh, activeNoGps].sort((a, b) =>
    compareVehicles(a, b, "priority", positions),
  );
  expect(byPriority.map((v) => v.plate)).toEqual([
    "ZZZ-999",
    "BBB-222",
    "AAA-111",
  ]);

  const byPlate = [idleGood, activeFresh, activeNoGps].sort((a, b) =>
    compareVehicles(a, b, "plate", positions),
  );
  expect(byPlate.map((v) => v.plate)).toEqual([
    "AAA-111",
    "BBB-222",
    "ZZZ-999",
  ]);

  expect(matchesSearch(activeFresh, "main hub", warehouses)).toBe(true);
});

test("fleet-map-1 road-route rejects invalid coordinates and never synthesizes straight-line fallbacks", async () => {
  fetchSpy = spyOn(globalThis, "fetch");
  const bad = await GET(
    new Request("http://localhost/panel/fleet-map-1/road-route?waypoints=181,14;121,14"),
  );
  expect(bad.status).toBe(400);
  expect(fetchSpy).not.toHaveBeenCalled();

  process.env.OSRM_ROUTING_URL = "https://routing.example.test";
  fetchSpy.mockResolvedValue(Response.json(providerResponse()));
  const ok = await GET(
    new Request(
      `http://localhost/panel/fleet-map-1/road-route?waypoints=${encodeURIComponent(roadRouteKey([warehouse, stopCoord, warehouse]))}`,
    ),
  );
  expect(ok.status).toBe(200);
  const parsed = (await ok.json()) as RoadRoute;
  expect(parsed.distance).toBe(4400);
  expect(parsed.duration).toBe(420);

  fetchSpy.mockResolvedValue(Response.json({ code: "NoRoute" }));
  const noRoute = await GET(
    new Request(
      "http://localhost/panel/fleet-map-1/road-route?waypoints=121,14;121.1,14.1",
    ),
  );
  expect(noRoute.status).toBe(502);
  expect(await noRoute.json()).not.toHaveProperty("coordinates");

  expect(() => parseRoadRoute({ code: "NoRoute" }, 3)).toThrow();
  expect(pointAlongRoad([warehouse, corner], 0.5)).toEqual([121.005, 14.5]);
  expect(getBounds([warehouse, stopCoord])).toEqual([warehouse, stopCoord]);
});

test("liveRoutePoints handles active GPS trips and idle scheduled previews without fabricating live GPS", () => {
  const stop = makeStop();
  const delivering = makeVehicle({ status: "delivering", stops: [stop] });
  const idle = makeVehicle({ status: "available" });
  const preview = {
    id: "9",
    label: "Afternoon run",
    scheduledAt: "2026-11-11T14:00:00+08:00",
    phase: "upcoming",
    stops: [stop],
  } satisfies Trip;

  const livePos: ResolvedPosition = {
    coordinates: [121.005, 14.505],
    signal: "live",
    health: "fresh",
    isEstimated: false,
    speedKph: 20,
    heading: 0,
    ageMs: 1000,
    recordedAt: "2026-11-11T08:00:00Z",
  };
  const noPos: ResolvedPosition = {
    coordinates: warehouse,
    signal: "none",
    health: "none",
    isEstimated: true,
    speedKph: null,
    heading: null,
    ageMs: null,
    recordedAt: null,
  };

  expect(liveRoutePoints(delivering, warehouses, livePos)).toEqual([
    livePos.coordinates,
    stop.coordinates,
  ]);
  expect(liveRoutePoints(delivering, warehouses, noPos)).toEqual([]);
  expect(liveRoutePoints(idle, warehouses, noPos, preview)).toEqual([
    warehouse,
    stop.coordinates,
  ]);
});
