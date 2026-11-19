import type { Coordinates, MapLayers, WarehouseLocation } from "./types";

export const DEFAULT_MAP_CENTER: Coordinates = [121.035, 14.603];

export const EMPTY_WAREHOUSES: WarehouseLocation[] = [];

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

export const LIVE_POLL_MS = 5_000;
export const FLEET_POLL_MS = 15_000;

export const GPS_FRESH_MS = 60_000;
export const GPS_STALE_MS = 2 * 60_000;
export const GPS_FUTURE_CLOCK_SKEW_MS = 30_000;

export const CO_LOCATION_RADIUS_M = 35;

export const DEFAULT_MAP_LAYERS: MapLayers = {
  routes: true,
  allActiveRoutes: true,
  stops: true,
  warehouses: true,
  returns: true,
};
