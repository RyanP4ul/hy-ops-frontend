export type Coordinates = [number, number];

export type WarehouseLocation = {
  id: string;
  name: string;
  /** Display string, e.g. "1 Main St, Quezon City, NCR 1100". */
  address: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  coordinates: Coordinates;
};

export type PaymentArrangement =
  "FULLY_PAID" | "PARTIALLY_PAID" | "PAY_ON_DELIVERY" | "NET_30";

export type PaymentMethod = "CASH" | "BANK_TRANSFER" | "CARD";

export type OrderItem = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number | null;
};

export type OrderDetails = {
  id: string;
  customer: {
    name: string;
    code: string;
    phone: string;
  };
  paymentArrangement: PaymentArrangement;
  /** Method of the latest payment; null until something has been paid. */
  paymentMethod: PaymentMethod | null;
  paymentType?: string | null;
  totalAmount: number | null;
  amountPaid: number;
  /** ISO date (YYYY-MM-DD), NET_30 orders only. */
  dueDate?: string;
  items: OrderItem[];
};

export type DeliveryStop = {
  id: string;
  name: string;
  address: string;
  coordinates: Coordinates;
  status: "pending" | "completed";
  order: OrderDetails;
};

export type TripMeta = {
  id: string;
  label: string;
  scheduledAt: string; // ISO 8601 with offset, e.g. 2026-10-24T09:00:00+08:00
};

export type Trip = TripMeta & {
  phase: "upcoming" | "overdue";
  stops: DeliveryStop[];
};

export type BlockedReason = "maintenance" | "unavailable" | "on_delivery";

export type Vehicle = {
  pickups?: { id: number; orderNumber: string; customer: string; address: string; status: string; coordinates: Coordinates | null; version: number }[];
  id: string;
  driver: string;
  plate: string;
  color: string; // REQUIRED
  warehouseId: string;
  trip: TripMeta | null; // the trip the vehicle is running (or just finished); null if it has none yet
  stops: DeliveryStop[]; // stops of the current trip
  scheduledTrips: Trip[]; // upcoming trips, earliest first
  legIndex: number; // by default use 0 and no need to put this in json property
  progress: number; // NOT REQUIRED
  completedStops: number;
  status: "delivering" | "returning" | "available";
  /** Set when the vehicle is idle but cannot take a trip. */
  blockedReason?: BlockedReason;
  /** Only meaningful while simulating; real speed comes from the live position feed. */
  speed: number;
};

export type FleetOverview = {
  vehicles: Vehicle[];
  warehouses: WarehouseLocation[];
};

/** Latest GPS fix for one vehicle, as returned by GET /api/fleet/positions. */
export type LivePosition = {
  vehicleId: string;
  coordinates: Coordinates;
  speedKph: number | null;
  heading: number | null;
  /** ISO 8601 time the device recorded the fix. */
  recordedAt: string;
  receivedAt?: string | null;
  accuracyM?: number | null;
  sampleIntervalSeconds?: number | null;
};

/**
 * How trustworthy the on-map position of a vehicle is.
 * - live: a recent real GPS fix
 * - stale: a real fix, but older than STALE_AFTER_MS
 * - none: no fix known (position is estimated from trip progress)
 * - simulated: simulation mode is on (test data, not real)
 */
export type SignalState = "live" | "stale" | "none" | "simulated";

export type ResolvedPosition = {
  coordinates: Coordinates;
  signal: SignalState;
  speedKph: number | null;
  heading: number | null;
  /** Age of the last real fix in ms; null when unavailable or in simulation mode. */
  ageMs: number | null;
  sampleIntervalSeconds?: number | null;
  accuracyM?: number | null;
};
