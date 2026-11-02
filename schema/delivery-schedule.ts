import { z } from "zod";

export const deliveryScheduleSchema = z.object({
  warehouse_id: z.number().min(1, "Warehouse is required"),
  order_ids: z.array(z.number()).min(1, "At least one order must be selected"),
  scheduled_date: z.date({
    error: "Scheduled date is required",
  }),
  scheduled_time: z.string().min(1, "Scheduled time is required"),
  delivery_type: z.string().min(1, "Delivery type is required"),
  driver_id: z.number().min(1, "Driver is required"),
  vehicle_id: z.number().min(1, "Vehicle is required"),
  delivery_allowance: z
    .number()
    .min(0, "Delivery allowance must be a non-negative number"),
  fuel: z.number().min(0, "Fuel must be a non-negative number"),
  toll: z.number().min(0, "Toll must be a non-negative number"),
});

export type DeliveryScheduleFormData = z.infer<typeof deliveryScheduleSchema>;

export type DeliveryScheduleOrderDetail = {
  id: number;
  order_number: string;
  customer_company: string | null;
  destination: string | null;
  shipping_latitude: string | null;
  shipping_longitude: string | null;
  item_count: number;
  total: number | null;
};

export const orderSchema = z.object({
  order_id: z.number().nonnegative("Order ID must be a non-negative number"),
});

export type OrderFormData = z.infer<typeof orderSchema>;

export type DeliveryScheduleRow = {
  warehouse_id: number;
  id: number;
  order_number: string;
  customer_name: string;
  customer_company: string;
  shipping_address: string | null;
  shipping_latitude: string | null;
  shipping_longitude: string | null;
  version: number;
  payment_arrangement: string;
};
