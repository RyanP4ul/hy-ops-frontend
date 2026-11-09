export type Booking = {
  id: number;
  order_id: number;
  order_number?: string;
  environment: string;
  status: string;
  booking_state: string;
  active: boolean;
  lalamove_order_id: string | null;
  delivery_fee: string | null;
  currency: string | null;
  share_link: string | null;
  driver_details: { name?: string; phone?: string; plateNumber?: string } | null;
  failure_message: string | null;
  last_synced_at: string | null;
  picked_up_at: string | null;
  completed_at?: string | null;
  recipient_name?: string;
  pickup_address?: string;
  dropoff_address?: string;
  evidence?: { stop_id: string; status: string; delivered_at: string | null }[];
};

export type PickupWarehouse = {
  id: number; name: string; street_address: string; city: string; state: string; zip_code: string;
  phone_number: string | null; latitude?: string | null; longitude?: string | null; version?: number;
};

export type Context = {
  order: { id: number; order_number: string; version: number; status: string; shipping_address: string | null; shipping_recipient: string | null; delivery_method: string | null };
  warehouse: PickupWarehouse;
  bookings: Booking[];
  history: { id: string; event_type: string; state: string; created_at: string; last_error: string | null }[];
  can_reconcile: boolean;
  eligible: boolean;
  reason: string | null;
  enabled: boolean;
  environment: string;
};

export type City = {
  locode: string;
  name: string;
  services: { key: string; description?: string; load?: { value: string; unit: string }; dimensions?: Record<string, { value: string; unit: string }> }[];
};

export type Quotation = {
  quotation_ref: string;
  expiresAt: string;
  serviceType: string;
  priceBreakdown: Record<string, string>;
  route: { pickup: { address: string }; dropoff: { address: string } };
};

export type Setup = { can_manage: boolean; enabled: boolean; environment: string; callback_url?: string | null; callback_path?: string; last_callback_at?: string | null };
export type Reconciliation = { can_reconcile: boolean; events: { id: string; event_type: string; provider_order_id: string | null; state: string; attempts: number; last_error: string | null }[] };
export type ReadyOrder = { id: number; order_number: string; shipping_address: string };
export type Action = (work: () => Promise<unknown>) => Promise<boolean>;
