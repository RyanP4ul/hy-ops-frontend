import type { Coordinates, MapLayers, WarehouseLocation } from "./types";

/** Metro Manila; used only when there is no warehouse to center on. */
export const DEFAULT_MAP_CENTER: Coordinates = [121.035, 14.603];

/** Stable reference so `data?.warehouses ?? EMPTY_WAREHOUSES` doesn't retrigger effects. */
export const EMPTY_WAREHOUSES: WarehouseLocation[] = [];

/** Returned by getWarehouse() when a vehicle points at a warehouse that no longer exists. */
export const FALLBACK_WAREHOUSE: WarehouseLocation = {
  id: "",
  name: "No warehouse",
  address: "No warehouse assigned",
  streetAddress: "",
  city: "",
  state: "",
  zipCode: "",
  coordinates: DEFAULT_MAP_CENTER,
};

/** How often live GPS positions are polled (cheap endpoint). */
export const LIVE_POLL_MS = 5_000;

/** How often trips / stops / statuses are refreshed from the database. */
export const FLEET_POLL_MS = 15_000;

/** Centralized GPS freshness thresholds (aligned with 5s polling & driver reporting). */
export const GPS_FRESH_MS = 60_000;
export const GPS_STALE_MS = 2 * 60_000;
export const STALE_AFTER_MS = GPS_STALE_MS;
export const GPS_FUTURE_CLOCK_SKEW_MS = 30_000;

/** Vehicles within this distance are grouped into a selectable cluster marker without moving them. */
export const CO_LOCATION_RADIUS_M = 35;

/** Idle vehicles within this distance of their warehouse are counted as parked at base. */
export const AT_WAREHOUSE_RADIUS_M = 150;

export const DEFAULT_MAP_LAYERS: MapLayers = {
  routes: true,
  allActiveRoutes: true,
  stops: true,
  warehouses: true,
  returns: true,
};
