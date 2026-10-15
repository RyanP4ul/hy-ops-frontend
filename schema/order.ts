import { z } from "zod";

export const orderItemSchema = z.object({
  id: z.number().optional(),
  order_id: z.number().optional(),
  inventory_id: z.number().nonnegative("Required to select a item"),
  quantity: z.number().min(1, "Quantity must be at least 1"),
});

export type OrderItem = z.infer<typeof orderItemSchema>;

export const OrderItemDetailSchema = z.object({
  inventory_id: z.number().nonnegative("Inventory ID is required"),
  product_id: z.number().min(1, "Product is required"),
  product_variant_name: z.string().min(1, "Variant name is required"),
  product_variant_sku: z.string().min(1, "Variant SKU is required"),
  quantity: z.number().min(1, "Quantity must be at least 1"),
  price: z.number().nonnegative("Price must be a non-negative number"),
  description: z.string(),
});

export const orderSchema = z
  .object({
    customer_id: z.number().min(1, "Customer is required"),
    delivery_type: z.string().min(1, "Delivery type is required"),
    payment_arrangement: z.string().min(1, "Payment arrangement is required"),
    notes: z.string().optional(),
    is_custom_shipping: z.boolean(),
    shipping_recipient: z
      .string()
      .min(1, "Shipping recipient is required")
      .max(60, "Shipping recipient is too long")
      .optional(),
    shipping_phone: z
      .string()
      .min(1, "Shipping phone is required")
      .max(20, "Shipping phone is too long")
      .optional(),
    shipping_address: z
      .string()
      .min(1, "Shipping address is required")
      .max(100, "Shipping address is too long")
      .optional(),
    items: z
      .array(OrderItemDetailSchema)
      .min(1, "At least one item is required"),
    payment_method: z.string(),
    amount_paid: z
      .number()
      .nonnegative("Amount paid must be a non-negative number"),
  })
  .superRefine((data, ctx) => {
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

export type OrderRow = {
  id: number;
  customer_name: string;
  email: string;
  customer_company: string;
  delivery_type: string;
  status: string;
  item_count: number;
  total_quantity: number;
  total: number;
  items?: OrderItemDetail[];
};

export type OrderForm = z.infer<typeof orderSchema>;

export type OrderDetail = OrderForm & {
  id: number;
  customer_name: string;
  items: OrderItemDetail[];
};

export type OrderFormWithItems = OrderForm & {
  items?: { product_id: number; quantity: number }[];
};
