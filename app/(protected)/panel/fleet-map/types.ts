export type Coordinates = [number, number];

export type WarehouseLocation = {
  id: string;
  name: string;
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
  paymentMethod: PaymentMethod | null;
  paymentType?: string | null;
  totalAmount: number | null;
  amountPaid: number;
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
  scheduledAt: string;
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
  blockedReason?: BlockedReason;
  speed: number;
};

export type FleetOverview = {
  vehicles: Vehicle[];
  warehouses: WarehouseLocation[];
};

export type LivePosition = {
  vehicleId: string;
  coordinates: Coordinates;
  speedKph: number | null;
  heading: number | null;
  recordedAt: string;
  receivedAt?: string | null;
  accuracyM?: number | null;
  sampleIntervalSeconds?: number | null;
};

export type SignalState = "live" | "stale" | "none" | "simulated";

export type GpsHealth = "fresh" | "delayed" | "stale" | "none" | "simulated";

export type ResolvedPosition = {
  coordinates: Coordinates;
  signal: SignalState;
  health: GpsHealth;
  isEstimated: boolean;
  speedKph: number | null;
  heading: number | null;
  ageMs: number | null;
  recordedAt: string | null;
  sampleIntervalSeconds?: number | null;
  accuracyM?: number | null;
};

export type WorkspaceMode = "map" | "table";

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
