import type {
  BlockedReason,
  DeliveryStop,
  FleetCounts,
  GpsHealth,
  ResolvedPosition,
  StopEnrichment,
  Vehicle,
  VehicleFilter,
  VehicleSortKey,
  WarehouseLocation,
} from "../types";
import { getWarehouse } from "./geometry";
import { needsGpsAttention } from "./live";

export function isRouteComplete(vehicle: Vehicle): boolean {
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

export function isBlockedVehicle(
  vehicle: Pick<Vehicle, "status" | "blockedReason">,
): boolean {
  return vehicle.status === "available" && vehicle.blockedReason !== undefined;
}

export function getOperationalStatusKey(
  vehicle: Pick<Vehicle, "status" | "blockedReason">,
): Vehicle["status"] | BlockedReason {
  return vehicle.blockedReason ?? vehicle.status;
}

export function getTripValue(stops: DeliveryStop[]): number | null {
  if (stops.some((stop) => stop.order.totalAmount === null)) return null;
  return stops.reduce((sum, stop) => sum + (stop.order.totalAmount ?? 0), 0);
}

export function getProgressPercent(vehicle: Vehicle): number {
  if (vehicle.stops.length === 0) return 0;
  return Math.round((vehicle.completedStops / vehicle.stops.length) * 100);
}

export function getNextPendingStop(
  vehicle: Vehicle,
): DeliveryStop | undefined {
  const pending = vehicle.stops.filter(stop => stop.status === "pending" && !stop.skippedForNow);
  return pending.find(stop => stop.deliverNext) ?? pending[0];
}

export function computeFleetCounts(
  vehicles: Vehicle[],
  positions: Map<string, ResolvedPosition>,
): FleetCounts {
  let delivering = 0;
  let returning = 0;
  let available = 0;
  let blocked = 0;
  let gpsAttention = 0;

  for (const vehicle of vehicles) {
    if (vehicle.status === "delivering") delivering++;
    else if (vehicle.status === "returning") returning++;
    else if (isBlockedVehicle(vehicle)) blocked++;
    else available++;

    if (needsGpsAttention(vehicle, positions.get(vehicle.id))) {
      gpsAttention++;
    }
  }

  return {
    total: vehicles.length,
    delivering,
    returning,
    available,
    blocked,
    gpsAttention,
  };
}

export function matchesFilter(
  vehicle: Vehicle,
  filter: VehicleFilter,
  position?: ResolvedPosition,
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "delivering":
      return vehicle.status === "delivering";
    case "returning":
      return vehicle.status === "returning";
    case "available":
      return isAvailableVehicle(vehicle);
    case "blocked":
      return isBlockedVehicle(vehicle);
    case "gps_attention":
      return needsGpsAttention(vehicle, position);
  }
}

export function matchesSearch(
  vehicle: Vehicle,
  query: string,
  warehouses: WarehouseLocation[],
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const warehouse = getWarehouse(vehicle, warehouses);

  return (
    vehicle.plate.toLowerCase().includes(q) ||
    vehicle.driver.toLowerCase().includes(q) ||
    warehouse.name.toLowerCase().includes(q) ||
    (vehicle.trip?.label.toLowerCase().includes(q) ?? false) ||
    vehicle.stops.some(
      (stop) =>
        stop.name.toLowerCase().includes(q) ||
        stop.address.toLowerCase().includes(q) ||
        stop.order.id.toLowerCase().includes(q) ||
        stop.order.customer.name.toLowerCase().includes(q),
    ) ||
    (vehicle.pickups?.some(
      (p) =>
        p.orderNumber.toLowerCase().includes(q) ||
        p.customer.toLowerCase().includes(q),
    ) ??
      false)
  );
}

const GPS_SORT_RANK: Record<GpsHealth, number> = {
  none: 0,
  stale: 1,
  delayed: 2,
  fresh: 3,
  simulated: 4,
};

function priorityTier(
  vehicle: Vehicle,
  position: ResolvedPosition | undefined,
): number {
  const attention = needsGpsAttention(vehicle, position);
  if (vehicle.status !== "available" && attention) return 0;
  if (vehicle.status === "delivering") return 1;
  if (vehicle.status === "returning") return 2;
  if (isAvailableVehicle(vehicle)) return 3;
  return 4;
}

export function compareVehicles(
  a: Vehicle,
  b: Vehicle,
  sortKey: VehicleSortKey,
  positions: Map<string, ResolvedPosition>,
): number {
  const posA = positions.get(a.id);
  const posB = positions.get(b.id);

  switch (sortKey) {
    case "plate":
      return a.plate.localeCompare(b.plate);
    case "gps": {
      const rankA = posA ? GPS_SORT_RANK[posA.health] : 0;
      const rankB = posB ? GPS_SORT_RANK[posB.health] : 0;
      return (
        rankA - rankB ||
        (posB?.ageMs ?? Number.MAX_SAFE_INTEGER) -
          (posA?.ageMs ?? Number.MAX_SAFE_INTEGER) ||
        a.plate.localeCompare(b.plate)
      );
    }
    case "progress": {
      const activeA = a.status !== "available" ? 0 : 1;
      const activeB = b.status !== "available" ? 0 : 1;
      return (
        activeA - activeB ||
        getProgressPercent(b) - getProgressPercent(a) ||
        a.plate.localeCompare(b.plate)
      );
    }
    case "priority":
    default:
      return (
        priorityTier(a, posA) - priorityTier(b, posB) ||
        a.plate.localeCompare(b.plate)
      );
  }
}

export type StopEntry = {
  stop: DeliveryStop;
  sequence: number;
  enrichment?: StopEnrichment;
};

export type DestinationStopGroup = {
  key: string;
  destinationName: string;
  address: string;
  coordinates: DeliveryStop["coordinates"];
  orderGroupNumber: string | null;
  entries: StopEntry[];
};

/**
 * Groups consecutive or co-located stops only when they share BOTH verified
 * coordinates AND normalized shipping address (or a shared backend order_group_id
 * with matching coordinates). Never groups solely on customer name.
 */
export function groupStopsByVerifiedDestination(
  stops: DeliveryStop[],
  enrichmentByStopId: Map<string, StopEnrichment>,
): DestinationStopGroup[] {
  const groups: DestinationStopGroup[] = [];

  stops.forEach((stop, index) => {
    const enrichment = enrichmentByStopId.get(stop.id);
    const entry: StopEntry = {
      stop,
      sequence: index + 1,
      enrichment,
    };

    const coordKey = `${stop.coordinates[0].toFixed(6)},${stop.coordinates[1].toFixed(6)}`;
    const normAddress = stop.address.trim().toLowerCase();
    const canMatchAddress =
      normAddress.length > 0 && normAddress !== "no address on file";

    const match = groups.find((group) => {
      const groupCoordKey = `${group.coordinates[0].toFixed(6)},${group.coordinates[1].toFixed(6)}`;
      if (groupCoordKey !== coordKey) return false;
      if (
        enrichment?.orderGroupId &&
        group.entries.some(
          (item) => item.enrichment?.orderGroupId === enrichment.orderGroupId,
        )
      ) {
        return true;
      }
      return (
        canMatchAddress &&
        group.address.trim().toLowerCase() === normAddress
      );
    });

    if (match) {
      match.entries.push(entry);
      if (!match.orderGroupNumber && enrichment?.orderGroupNumber) {
        match.orderGroupNumber = enrichment.orderGroupNumber;
      }
    } else {
      groups.push({
        key: `dest-${stop.id}`,
        destinationName: stop.name,
        address: stop.address,
        coordinates: stop.coordinates,
        orderGroupNumber: enrichment?.orderGroupNumber ?? null,
        entries: [entry],
      });
    }
  });

  return groups;
}
