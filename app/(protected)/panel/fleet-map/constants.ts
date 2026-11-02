import type { Coordinates, WarehouseLocation } from "./types";

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

/** A GPS fix older than this is shown as "last seen …" instead of "live". */
export const STALE_AFTER_MS = 2 * 60_000;

/** Idle vehicles within this distance of their warehouse are drawn as part of its marker. */
export const AT_WAREHOUSE_RADIUS_M = 150;
