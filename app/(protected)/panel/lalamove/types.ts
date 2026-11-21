export type DriverCoordinates = {
  lat: number;
  lng: number;
  updated_at: string | null;
};

export type BookingStop = {
  id: number;
  booking_id: number;
  order_id: number;
  order_number: string;
  order_status: string;
  stop_index: number;
  lalamove_stop_id: string | null;
  recipient_name: string;
  recipient_phone: string;
  dropoff_address: string;
  dropoff_lat?: string | null;
  dropoff_lng?: string | null;
  pod_status: string | null;
  delivered_at: string | null;
};

export type Booking = {
  id: number;
  order_id: number;
  order_number?: string;
  pickup_warehouse_id?: number | null;
  is_route_optimized?: boolean;
  stop_count?: number;
  stops?: BookingStop[];
  environment: string;
  status: string;
  booking_state: string;
  active: boolean;
  lalamove_order_id: string | null;
  delivery_fee: string | null;
  currency: string | null;
  share_link: string | null;
  driver_details: {
    name?: string;
    phone?: string;
    plateNumber?: string;
    coordinates?: {
      lat?: string | number;
      lng?: string | number;
      updatedAt?: string;
    };
  } | null;
  driver_coordinates?: DriverCoordinates | null;
  failure_message: string | null;
  last_synced_at: string | null;
  picked_up_at: string | null;
  completed_at?: string | null;
  recipient_name?: string;
  pickup_address?: string;
  dropoff_address?: string;
  evidence?: {
    stop_id: string;
    status: string;
    delivered_at: string | null;
    order_id?: number;
    order_number?: string;
    stop_index?: number;
  }[];
};

export type PickupWarehouse = {
  id: number;
  name: string;
  street_address: string;
  city: string;
  state: string;
  zip_code: string;
  phone_number: string | null;
  latitude?: string | null;
  longitude?: string | null;
  version?: number;
};

export type Context = {
  order: {
    id: number;
    order_number: string;
    version: number;
    status: string;
    shipping_address: string | null;
    shipping_recipient: string | null;
    shipping_latitude?: string | null;
    shipping_longitude?: string | null;
    delivery_method: string | null;
  };
  warehouse: PickupWarehouse;
  bookings: Booking[];
  history: {
    id: string;
    event_type: string;
    state: string;
    created_at: string;
    last_error: string | null;
  }[];
  can_reconcile: boolean;
  eligible: boolean;
  reason: string | null;
  enabled: boolean;
  environment: string;
};

export type BookingContext = {
  booking: Booking;
  warehouse: PickupWarehouse | null;
  history: {
    id: string;
    event_type: string;
    state: string;
    created_at: string;
    last_error: string | null;
  }[];
  can_reconcile: boolean;
  enabled: boolean;
  environment: string;
};

export type City = {
  locode: string;
  name: string;
  services: {
    key: string;
    description?: string;
    load?: { value: string; unit: string };
    dimensions?: Record<string, { value: string; unit: string }>;
  }[];
};

export type Quotation = {
  quotation_ref: string;
  expiresAt: string;
  serviceType: string;
  priceBreakdown: Record<string, string>;
  route: { pickup: { address: string }; dropoff: { address: string } };
};

export type MultiStopQuotation = {
  quotation_ref: string;
  expiresAt: string;
  serviceType: string;
  priceBreakdown: Record<string, string>;
  is_route_optimized: boolean;
  route_reordered: boolean;
  pickup_warehouse_id: number;
  route: {
    pickup: { address: string; name: string; phone: string };
    dropoffs: {
      order_id: number;
      order_number: string;
      address: string;
      name: string;
      phone: string;
      stop_id?: string;
    }[];
  };
};

export type Setup = {
  can_manage: boolean;
  enabled: boolean;
  environment: string;
  callback_url?: string | null;
  callback_path?: string;
  last_callback_at?: string | null;
};

export type Reconciliation = {
  can_reconcile: boolean;
  events: {
    id: string;
    event_type: string;
    provider_order_id: string | null;
    state: string;
    attempts: number;
    last_error: string | null;
  }[];
};

export type ReadyOrder = {
  id: number;
  order_number: string;
  version?: number;
  warehouse_id?: number;
  lalamove_pickup_warehouse_id?: number | null;
  delivery_method?: string | null;
  payment_arrangement?: string | null;
  stock_reserved?: boolean;
  shipping_recipient?: string | null;
  shipping_phone?: string | null;
  shipping_address: string | null;
  shipping_latitude?: string | null;
  shipping_longitude?: string | null;
  order_group_id?: string | null;
  order_group_number?: string | null;
  order_group_position?: number | null;
  order_group_size?: number | null;
  customer_name?: string | null;
  customer_company?: string | null;
  ready_for_lalamove?: boolean;
  blocked_reason?: string | null;
};

export type Action = (work: () => Promise<unknown>) => Promise<boolean>;
