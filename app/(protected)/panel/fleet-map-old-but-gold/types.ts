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
  unitPrice: number;
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
  totalAmount: number;
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
  stops: DeliveryStop[];
};

export type BlockedReason = "maintenance" | "unavailable";

export type Vehicle = {
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
  speed: number;
};

export type DetailsTab = "current" | "scheduled";

export type SidebarView = "vehicles" | "schedule";

export type WarehouseFormState = {
  name: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  longitude: string;
  latitude: string;
};

export type FleetOverview = {
  vehicles: Vehicle[];
  warehouses: WarehouseLocation[];
};

export type WarehouseInput = {
  name: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  longitude: number;
  latitude: number;
};
