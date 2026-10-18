import { z } from "zod";

export const deliveryScheduleSchema = z.object({
  order_ids: z.array(z.number()).min(1, "At least one order must be selected"),
  scheduled_date: z.date({
    error: "Scheduled date is required",
  }),
  scheduled_time: z.string().min(1, "Scheduled time is required"),
  delivery_type: z.string().min(1, "Delivery type is required"),
  driver_id: z.number().min(1, "Driver is required"),
  vehicle_id: z.number().min(1, "Vehicle is required"),
});

export type DeliveryScheduleFormData = z.infer<typeof deliveryScheduleSchema>;

export type DeliveryScheduleOrderDetail = {
  id: number;
  order_number: string;
  customer_company: string | null;
  destination: string | null;
  item_count: number;
  total: number;
};

export const orderSchema = z.object({
  order_id: z.number().nonnegative("Order ID must be a non-negative number"),
});

export type OrderFormData = z.infer<typeof orderSchema>;

export type DeliveryScheduleRow = {
  id: number;
  order_number: string;
  customer_name: string;
  customer_company: string;
};
