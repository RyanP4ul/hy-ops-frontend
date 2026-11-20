import type { OrderGroupFields } from "./delivery-schedule";
import { z } from "zod";
import { orderPaymentMethodSchema } from "./order-payment-method";

export const orderItemSchema = z.object({
  id: z.number().optional(),
  order_id: z.number().optional(),
  inventory_id: z.number().int().positive("Select an item"),
  quantity: z.number().int("Quantity must be a whole number").min(1, "Quantity must be at least 1"),
});

export type OrderItem = z.infer<typeof orderItemSchema>;

export const OrderItemDetailSchema = z.object({
  inventory_id: z.number().int().positive("Inventory ID is required"),
  product_id: z.number().min(1, "Product is required"),
  product_variant_name: z.string().min(1, "Variant name is required"),
  product_variant_sku: z.string().min(1, "Variant SKU is required"),
  quantity: z.number().int("Quantity must be a whole number").min(1, "Quantity must be at least 1"),
  price: z.number().nonnegative("Price must be a non-negative number").optional(),
  description: z.string(),
});

export const orderSchema = z
  .object({
    warehouse_id: z.number().min(1, "Warehouse is required"),
    customer_id: z.number().min(1, "Customer is required"),
    delivery_type: z.string().min(1, "Delivery type is required"),
    payment_arrangement: z.string().min(1, "Payment arrangement is required"),
    notes: z.string().max(2000, "Notes must be 2000 characters or fewer").optional(),
    is_custom_shipping: z.boolean(),
    customer_address_id: z.number().int().positive().optional(),
    shipping_recipient: z
      .string()
      .max(60, "Shipping recipient is too long")
      .optional(),
    shipping_phone: z
      .string()
      .max(20, "Shipping phone is too long")
      .optional(),
    shipping_address: z
      .string()
      .max(255, "Shipping address is too long")
      .optional(),
    shipping_latitude: z.number().min(-90).max(90).optional(),
    shipping_longitude: z.number().min(-180).max(180).optional(),
    items: z
      .array(OrderItemDetailSchema)
      .min(1, "At least one item is required"),
    payment_method: orderPaymentMethodSchema,
    payment_type: z.string().trim().max(100, "Payment type must be 100 characters or fewer").optional(),
    amount_paid: z
      .number()
      .nonnegative("Amount paid must be a non-negative number"),
  })
  .superRefine((data, ctx) => {
    if (data.is_custom_shipping) {
      ctx.addIssue({ code: "custom", path: ["customer_address_id"], message: "Select a saved shipping address for this order" });
    }
    if (data.payment_method !== "CASH" && !data.payment_type?.trim()) {
      ctx.addIssue({ code: "custom", path: ["payment_type"], message: "Select or enter a payment type" });
    }
    if ((data.shipping_latitude === undefined) !== (data.shipping_longitude === undefined)) {
      ctx.addIssue({ code: "custom", path: ["shipping_latitude"], message: "Provide both latitude and longitude, or leave both blank." });
    }
    if (data.shipping_latitude === 0 && data.shipping_longitude === 0) ctx.addIssue({ code: "custom", path: ["shipping_latitude"], message: "Confirm the destination; (0, 0) is not a verified location." });
    if (data.is_custom_shipping) {
      if (!data.shipping_recipient?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["shipping_recipient"],
          message: "Shipping recipient is required",
        });
      }

      if (!data.shipping_phone?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["shipping_phone"],
          message: "Shipping phone is required",
        });
      }

      if (!data.shipping_address?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["shipping_address"],
          message: "Shipping address is required",
        });
      }
    } else if (!data.customer_address_id) {
      ctx.addIssue({
        code: "custom",
        path: ["customer_address_id"],
        message: "Select a saved shipping address",
      });
    }
  });

export type OrderItemDetail = z.infer<typeof OrderItemDetailSchema>;

// export type OrderItemDetail = {
//   id: number;
//   product_id: number;
//   product_variant_name: string;
//   product_variant_sku: string;
//   quantity: number;
//   price: number;
// };

export type OrderGroupMemberSummary = {
  id: number;
  order_number: string;
  order_group_position: number | null;
  status: string;
  warehouse_name?: string | null;
  shipping_address?: string | null;
  total: number | null;
};

export type OrderRow = Partial<OrderGroupFields> & {
  entry_type?: "SINGLE" | "GROUP";
  sales_channel?: "STANDARD" | "WALK_IN";
  product_number?: string;
  id: number;
  warehouse_id?: number | null;
  warehouse_name?: string | null;
  warehouse_names?: string[];
  shipping_address?: string | null;
  destinations?: string[];
  customer_name: string;
  email: string;
  customer_company: string;
  delivery_type: string;
  status: string;
  status_counts?: Record<string, number>;
  active_member_count?: number;
  ready_for_scheduling_count?: number;
  pending_action_count?: number;
  processing_action_count?: number;
  item_count: number;
  total_quantity: number;
  total: number | null;
  items?: OrderItemDetail[];
  members?: OrderTableRow[];
};

export type OrderTableRow = OrderRow & {
  version: number;
};

export function formatOrderGroupCode(groupNumber?: string | null): string {
  if (!groupNumber) return "";
  if (groupNumber.length <= 14) return groupNumber;
  return `${groupNumber.slice(0, 7)}…${groupNumber.slice(-4)}`;
}

export type OrderForm = z.infer<typeof orderSchema>;

export type OrderItemDetailView = Omit<OrderItemDetail, "price"> & {
  product_name?: string | null;
  price: number | null;
};

export type CombinedPaymentInfo = { payment_number: string; amount: number; allocated_amount: number; reference_number?: string | null };

export type OrderDeliveryAssignment = {
  delivery_id: number;
  delivery_status: string;
  delivery_type: string;
  scheduled_date: string;
  departure_time: string;
  stop_status: string;
  delivered_at: string | null;
  driver_name: string | null;
  vehicle_plate: string | null;
  vehicle_type: string | null;
};

export type OrderDetail = Omit<OrderForm, "items" | "payment_method" | "payment_type"> & Partial<OrderGroupFields> & {
  sales_channel?: "STANDARD" | "WALK_IN";
  warehouse_name?: string | null;
  payment_method: string;
  payment_type?: string | null;
  id: number;
  order_number: string;
  invoice_number?: string | null;
  walk_in_amount_tendered?: number | null;
  combined_payment?: CombinedPaymentInfo | null;
  delivery?: OrderDeliveryAssignment | null;
  group_members?: OrderGroupMemberSummary[];
  version: number;
  customer_name: string;
  customer_company?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  status?: string;
  tracking_token?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  items: OrderItemDetailView[];
};

export type OrderFormWithItems = OrderForm & {
  items?: { product_id: number; quantity: number }[];
};
