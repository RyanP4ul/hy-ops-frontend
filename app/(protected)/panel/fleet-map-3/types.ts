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
  | "FULLY_PAID"
  | "PARTIALLY_PAID"
  | "PAY_ON_DELIVERY"
  | "NET_30";

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
  skippedForNow?: boolean;
  deliverNext?: boolean;
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

export type VehicleReturnPickup = {
  id: number;
  orderNumber: string;
  customer: string;
  address: string;
  status: string;
  coordinates: Coordinates | null;
  version: number;
};

export type Vehicle = {
  pickups?: VehicleReturnPickup[];
  id: string;
  driver: string;
  plate: string;
  color: string;
  warehouseId: string;
  trip: TripMeta | null;
  stops: DeliveryStop[];
  scheduledTrips: Trip[];
  legIndex: number;
  progress: number;
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

export type SignalState = "live" | "stale" | "none" | "simulated";

/**
 * Granular GPS health modeled independently from vehicle operational status
 * and WebSocket connection state.
 */
export type GpsHealth = "fresh" | "delayed" | "stale" | "none" | "simulated";

export type ResolvedPosition = {
  coordinates: Coordinates;
  signal: SignalState;
  health: GpsHealth;
  /** True when coordinates are estimated from warehouse/stop progress (never live GPS). */
  isEstimated: boolean;
  speedKph: number | null;
  heading: number | null;
  /** Age of the last real fix in ms; null when unavailable or in simulation mode. */
  ageMs: number | null;
  recordedAt: string | null;
  sampleIntervalSeconds?: number | null;
  accuracyM?: number | null;
};

export type FleetView = "split" | "map" | "list";

export type FollowMode = "off" | "active" | "paused";

export type RealtimeStatus =
  | "connected"
  | "connecting"
  | "reconnecting"
  | "disconnected";

export type VehicleFilter =
  | "all"
  | "delivering"
  | "returning"
  | "available"
  | "blocked"
  | "gps_attention";

export type VehicleSortKey = "priority" | "plate" | "gps" | "progress";

export type StopOutcomeStatus = "pending" | "delivered" | "failed";

export type StopEnrichment = {
  stopId: string;
  orderId: number;
  orderNumber: string;
  actualStatus: StopOutcomeStatus;
  failureReason: string | null;
  orderGroupId: string | null;
  orderGroupNumber: string | null;
  orderGroupPosition: number | null;
  returnId: number | null;
  returnStatus: string | null;
};

export type ActiveDeliveryStopApiRow = {
  stop_id: number;
  return_id: number | null;
  return_status: string | null;
  order_id: number;
  order_number: string;
  order_group_id: string | null;
  order_group_position: number | null;
  order_group_number: string | null;
  status: StopOutcomeStatus;
  failure_reason: string | null;
};

export type ActiveDeliveryApiRow = {
  delivery_id: number;
  status: string;
  is_overdue: boolean;
  orders: ActiveDeliveryStopApiRow[];
};

export type DeliveryProofMeta = {
  id: string;
  kind: "photo" | "signature";
  contentType: string;
  byteSize: number;
  createdAt: string;
};

export type MapLayers = {
  routes: boolean;
  allActiveRoutes: boolean;
  stops: boolean;
  warehouses: boolean;
  returns: boolean;
};

export type FleetCounts = {
  total: number;
  delivering: number;
  returning: number;
  available: number;
  blocked: number;
  gpsAttention: number;
};
