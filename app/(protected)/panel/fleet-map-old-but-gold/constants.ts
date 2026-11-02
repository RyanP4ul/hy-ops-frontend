import type {
  Coordinates,
  Vehicle,
  WarehouseFormState,
  WarehouseLocation,
} from "./types";

/** Metro Manila; used only when there is no warehouse to center on. */
export const DEFAULT_MAP_CENTER: Coordinates = [121.035, 14.603];

export const EMPTY_WAREHOUSE_FORM: WarehouseFormState = {
  name: "",
  streetAddress: "",
  city: "",
  state: "",
  zipCode: "",
  longitude: "",
  latitude: "",
};

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

/** Stand-in for `selectedVehicle` while the fleet is empty, so the sidebar still renders. */
export function createEmptyVehicle(warehouseId: string): Vehicle {
  return {
    id: "",
    driver: "—",
    plate: "—",
    color: "#94a3b8",
    warehouseId,
    trip: null,
    stops: [],
    scheduledTrips: [],
    legIndex: 0,
    progress: 0,
    completedStops: 0,
    status: "available",
    speed: 0,
  };
}

/**
 * There is no GPS table, so vehicle movement is animated in the browser. By default that
 * animation is local-only. Set NEXT_PUBLIC_FLEET_PERSIST_SIMULATION=true (demo/staging only)
 * to also write the simulated stop deliveries / trip completions to the database.
 * Never enable it next to a real driver app: both would be writing the same rows.
 */
export const PERSIST_SIMULATION =
  process.env.NEXT_PUBLIC_FLEET_PERSIST_SIMULATION === "true";
