import { z } from "zod";

export const walkInCartItemSchema = z.object({
  inventory_id: z.number().int().positive("Select an item"),
  sku: z.string(),
  product_name: z.string(),
  description: z.string().optional(),
  price: z.number().nonnegative(),
  available: z.number().int().nonnegative(),
  quantity: z.number().int("Quantity must be a whole number").min(1, "Quantity must be at least 1"),
});

export type WalkInCartItem = z.infer<typeof walkInCartItemSchema>;

export const walkInOrderFormSchema = z
  .object({
    fulfillment: z.enum(["TAKEAWAY", "DELIVERY"]).default("TAKEAWAY"),
    shipping_recipient: z.string().max(60).optional(),
    shipping_phone: z.string().max(20).optional(),
    shipping_address: z.string().max(1000).optional(),
    shipping_latitude: z.number().min(-90).max(90).optional(),
    shipping_longitude: z.number().min(-180).max(180).optional(),
    customer_address_id: z.number().int().positive().optional(),
    warehouse_id: z.number().int().min(1, "Select a warehouse"),
    buyer_mode: z.enum(["GUEST", "REGISTERED"]),
    customer_id: z.number().int().optional(),
    walk_in_name: z.string().max(60, "Name must be 60 characters or fewer").optional(),
    walk_in_phone: z.string().max(20, "Phone must be 20 characters or fewer").optional(),
    notes: z.string().max(2000, "Notes must be 2000 characters or fewer").optional(),
    payment_method: z.enum(["CASH", "BANK_TRANSFER", "CARD"]),
    payment_type: z.string().max(100, "Payment type must be 100 characters or fewer").optional(),
    amount_tendered: z.number().nonnegative("Amount tendered must be zero or greater"),
    items: z.array(walkInCartItemSchema).min(1, "Add at least one item to the counter sale"),
  })
  .superRefine((data, ctx) => {
    if (data.fulfillment === "DELIVERY") {
      for (const [key, label] of [["shipping_recipient", "Recipient name"], ["shipping_phone", "Phone number"], ["shipping_address", "Delivery address"]] as const) {
        if (!data[key]?.trim()) ctx.addIssue({ code: "custom", path: [key], message: `${label} is required for delivery` });
      }
      if (data.shipping_phone && (!/^[+()\d\s.-]{7,20}$/.test(data.shipping_phone.trim()) || data.shipping_phone.replace(/\D/g, "").length < 7)) ctx.addIssue({ code: "custom", path: ["shipping_phone"], message: "Enter a valid delivery phone number" });
      if (data.shipping_latitude === undefined || data.shipping_longitude === undefined || (data.shipping_latitude === 0 && data.shipping_longitude === 0)) ctx.addIssue({ code: "custom", path: ["shipping_latitude"], message: "Confirm the delivery latitude and longitude" });
    }
    const total =
      Math.round(
        data.items.reduce((sum, item) => sum + item.price * item.quantity, 0) * 100,
      ) / 100;

    for (const [idx, item] of data.items.entries()) {
      if (item.quantity > item.available) {
        ctx.addIssue({
          code: "custom",
          path: ["items", idx, "quantity"],
          message: `Only ${item.available} available in stock for ${item.sku}`,
        });
      }
    }

    if (data.buyer_mode === "REGISTERED" && (!data.customer_id || data.customer_id < 1)) {
      ctx.addIssue({
        code: "custom",
        path: ["customer_id"],
        message: "Select a registered customer or switch to Walk-in Guest",
      });
    }

    if (data.payment_method !== "CASH" && !data.payment_type?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["payment_type"],
        message: "Select or enter a payment type",
      });
    }

    const tenderedCents = Math.round(
      (Number.isFinite(data.amount_tendered) ? data.amount_tendered : 0) * 100,
    );
    const totalCents = Math.round(total * 100);

    if (tenderedCents < totalCents) {
      ctx.addIssue({
        code: "custom",
        path: ["amount_tendered"],
        message: "Amount tendered must cover the full order total",
      });
    } else if (data.payment_method !== "CASH" && tenderedCents !== totalCents) {
      ctx.addIssue({
        code: "custom",
        path: ["amount_tendered"],
        message: "Card and bank transfer payments must match the exact order total",
      });
    }
  });

export type WalkInOrderForm = z.infer<typeof walkInOrderFormSchema>;

export type WalkInSaleResult = {
  status: string;
  sales_channel: "WALK_IN";
  delivery_type: string;
  id: number;
  product_number: string;
  order_number: string;
  total: number;
  amount_tendered: number;
  change_due: number;
  customer_name: string;
  warehouse_name?: string;
  message: string;
};
