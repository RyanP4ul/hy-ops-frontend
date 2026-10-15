import { z } from "zod";

export const orderItemSchema = z.object({
  id: z.number().optional(),
  order_id: z.number().optional(),
  inventory_id: z.number().nonnegative("Required to select a item"),
  quantity: z.number().min(1, "Quantity must be at least 1"),
});

export type DeliveryScheduleRow = {
  id: number;
  order_number: string;
  customer_name: string;
  customer_company: string;
};
