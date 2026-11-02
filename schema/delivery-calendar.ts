export type DeliveryCalendarEntry = {
  id: number;
  version: number;
  date: string;
  start_time: string;
  status: "scheduled" | "in_transit" | "returning" | "completed" | "cancelled";
  driver: string;
  vehicle: string;
  warehouse: string;
  warehouseId: number;
  pickupCount: number;
  orders: { id: number; orderNumber: string; recipient: string | null; address: string | null; status: string }[];
};

export const deliveryStatusLabel: Record<DeliveryCalendarEntry["status"], string> = {
  scheduled: "Scheduled", in_transit: "In transit", returning: "Returning", completed: "Completed", cancelled: "Cancelled",
};
